import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHealthReport, cleanMessage, graphSecretWarning, isMondayInMiami } from "@/lib/monitoring/events";

// Failure log + alerts + daily health check (brief 01). The database table and Resend are faked here; the SQL of the
// alert claim is checked against scripts/local-db.
const h = vi.hoisted(() => ({
  rows: [] as { id: string; at: Date; area: string; severity: string; message: string; ref: string | null; alertedAt: Date | null }[],
  sent: [] as { to: string; subject: string; text?: string; scope: string }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/monitoring/store", () => ({
  insertEvent: vi.fn(async (e: { area: string; severity: string; message: string; ref: string | null }) => {
    const id = `row-${h.rows.length + 1}`;
    h.rows.push({ id, at: new Date(), alertedAt: null, ...e });
    return id;
  }),
  // same rule as the SQL: this row becomes the alert unless its area had one after `since`
  claimAlert: vi.fn(async (id: string, area: string, since: Date) => {
    if (h.rows.some((r) => r.area === area && r.alertedAt && r.alertedAt > since)) return false;
    h.rows.find((r) => r.id === id)!.alertedAt = new Date();
    return true;
  }),
  eventsSince: vi.fn(async (since: Date) => h.rows.filter((r) => r.at >= since)),
  purgeBefore: vi.fn(async () => {}),
}));
vi.mock("@/lib/email/resend", () => ({
  emailConfig: () => ({ apiKey: "re_test", from: "Tiny Humans <hello@tinyhumans.photography>", internalFrom: "no-reply <hello@tinyhumans.photography>", notify: "hello@tinyhumans.photography" }),
  sendEmail: vi.fn(async (e: { to: string; subject: string; text?: string; scope: string }) => {
    h.sent.push(e);
    return { id: "msg" };
  }),
}));
vi.mock("@/lib/payments/stripe", () => ({ verifyWebhookSignature: () => true }));
vi.mock("@/lib/payments/server", () => ({
  handleStripeEvent: vi.fn(async () => {
    // a database error whose message repeats customer data: only its name/code may reach the log
    throw Object.assign(new Error('insert failed for jane@example.com, (305) 555-0142'), { code: "23502" });
  }),
}));

const NOW = new Date("2026-11-17T13:00:00Z"); // a Tuesday
beforeEach(() => {
  h.rows.length = 0;
  h.sent.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.DATABASE_URL = "postgres://test@localhost/test";
  process.env.ALERT_EMAIL = "support@tinyhumans.photography";
  process.env.CRON_SECRET = "a-cron-secret-of-32-characters!!";
  process.env.GRAPH_SECRET_EXPIRES = "2028-10-04";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.DATABASE_URL;
});

const webhook = async () => {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=test" },
      body: JSON.stringify({ id: "evt_1TestFailure", type: "checkout.session.completed" }),
    }),
  );
};

describe("a Stripe webhook that fails", () => {
  it("writes a failure row and emails the owner once; a second failure in the same hour sends no second email", async () => {
    const res = await webhook();
    expect(res.status).toBe(500); // Stripe retries
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({ area: "stripe_webhook", severity: "critical", ref: "evt_1TestFailure" });
    expect(h.rows[0].message).toContain("Error 23502");
    expect(h.rows[0].message).not.toMatch(/jane|555/);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "support@tinyhumans.photography", scope: "monitoring.alert" });
    expect(h.sent[0].subject).toBe("Alert: Stripe payments (webhook) problem");
    expect(h.sent[0].text).toContain("evt_1TestFailure");

    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000));
    expect((await webhook()).status).toBe(500);
    expect(h.rows).toHaveLength(2);
    expect(h.sent).toHaveLength(1);

    // an hour after the alert: the next failure alerts again
    vi.setSystemTime(new Date(NOW.getTime() + 61 * 60_000));
    await webhook();
    expect(h.rows).toHaveLength(3);
    expect(h.sent).toHaveLength(2);
  });

  it("without a database (local mock mode, CI) nothing is saved or sent", async () => {
    delete process.env.DATABASE_URL;
    expect((await webhook()).status).toBe(500);
    expect(h.rows).toEqual([]);
    expect(h.sent).toEqual([]);
  });

  it("non-critical failures wait for the daily report", async () => {
    const { recordFailure } = await import("@/lib/monitoring/server");
    await recordFailure("email", "Email not sent (validation_error): resend.customer", { ref: "TH-1234" });
    expect(h.rows).toHaveLength(1);
    expect(h.sent).toEqual([]);
  });
});

const health = async (now: Date) => {
  const { GET } = await import("@/app/api/cron/health/route");
  vi.setSystemTime(now);
  return GET(new Request(`http://localhost/api/cron/health?now=${now.toISOString()}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
};
const seed = (area: string, severity: string, message: string, minutesAgo: number, ref: string | null = null) =>
  h.rows.push({ id: `seed-${h.rows.length}`, at: new Date(NOW.getTime() - minutesAgo * 60_000), area, severity, message, ref, alertedAt: null });

describe("the daily health check", () => {
  it("refuses requests without the cron secret", async () => {
    const { GET } = await import("@/app/api/cron/health/route");
    expect((await GET(new Request("http://localhost/api/cron/health"))).status).toBe(401);
  });

  it("with failures in the last 24 hours: answers and emails a summary", async () => {
    seed("stripe_webhook", "critical", "Webhook processing failed (Error 23502)", 30, "evt_1");
    seed("email", "error", "Email not sent (network_error): resend.customer", 90, "TH-1001");
    seed("email", "error", "Email not sent (network_error): resend.internal", 95, "TH-1001");
    seed("graph", "error", "Old one", 26 * 60); // older than 24 h: not in the report
    const res = await health(NOW);
    expect(await res.json()).toEqual({ kind: "problems", failures: 3, critical: 1, warnings: 0, sent: true });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toMatchObject({ to: "support@tinyhumans.photography", scope: "monitoring.health", subject: "Health check: 3 problems in the last 24 hours" });
    expect(h.sent[0].text).toContain("Stripe payments (webhook) (1, 1 critical)");
    expect(h.sent[0].text).toContain("Emails (Resend) (2)");
    expect(h.sent[0].text).toContain("resend.customer (ref TH-1001)");
    expect(h.sent[0].text).not.toContain("Old one");
  });

  it("with no failures: sends nothing, except the Monday 'all good'", async () => {
    const tuesday = await health(NOW);
    expect(await tuesday.json()).toMatchObject({ kind: "quiet", sent: false });
    expect(h.sent).toEqual([]);
    const monday = await health(new Date("2026-11-16T13:00:00Z"));
    expect(await monday.json()).toMatchObject({ kind: "all_good", sent: true });
    expect(h.sent.map((e) => e.subject)).toEqual(["Health check: all good this week"]);
  });

  it("GRAPH_SECRET_EXPIRES 20 days ahead puts a warning in the report", async () => {
    process.env.GRAPH_SECRET_EXPIRES = "2026-12-07";
    const res = await health(NOW);
    expect(await res.json()).toMatchObject({ kind: "problems", failures: 0, warnings: 1, sent: true });
    expect(h.sent[0].subject).toBe("Health check: something needs you");
    expect(h.sent[0].text).toContain("expires in 20 days (2026-12-07)");
  });
});

describe("unhandled API errors", () => {
  it("are saved with the route path and digest only; page errors are left to Next.js", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { onRequestError } = await import("@/instrumentation");
    const request = { path: "/api/booking/quote?zip=33139", method: "POST", headers: {} };
    await onRequestError(Object.assign(new Error("boom jane@example.com"), { digest: "123456" }), request, { routerKind: "App Router", routePath: "/api/booking/quote", routeType: "route", revalidateReason: undefined });
    await onRequestError(new Error("page"), { ...request, path: "/about" }, { routerKind: "App Router", routePath: "/about", routeType: "render", revalidateReason: undefined });
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({ area: "api", severity: "error", message: "Unhandled error in /api/booking/quote", ref: "123456" });
    delete process.env.NEXT_RUNTIME;
  });
});

describe("report wording", () => {
  it("masks anything that looks like an email address or phone number", () => {
    expect(cleanMessage("failed for jane@example.com at (305) 555-0142\nretry")).toBe("failed for [email] at [number] retry");
  });
  it("warns from 30 days before the Microsoft secret expires, and when it's missing", () => {
    const now = new Date("2026-11-17T13:00:00Z");
    expect(graphSecretWarning("2026-12-18", now)).toBeNull();
    expect(graphSecretWarning("2026-12-17", now)).toContain("expires in 30 days");
    expect(graphSecretWarning("2026-11-16", now)).toContain("expired 1 day ago");
    expect(graphSecretWarning(undefined, now)).toContain("isn't set");
    expect(graphSecretWarning("Oct 4 2028", now)).toContain("isn't a date");
  });
  it("Monday is Miami's Monday", () => {
    expect(isMondayInMiami(new Date("2026-11-16T13:00:00Z"))).toBe(true);
    expect(isMondayInMiami(new Date("2026-11-16T03:00:00Z"))).toBe(false); // Sunday night in Miami
  });
  it("critical areas come first", () => {
    const at = new Date("2026-11-17T12:00:00Z");
    const r = buildHealthReport({
      now: new Date("2026-11-17T13:00:00Z"),
      graphSecretExpires: "2028-10-04",
      events: [
        { at, area: "email", severity: "error", message: "a", ref: null },
        { at, area: "email", severity: "error", message: "b", ref: null },
        { at, area: "booking", severity: "critical", message: "c", ref: null },
      ],
    });
    expect(r.areas.map((a) => a.area)).toEqual(["booking", "email"]);
    const same = buildHealthReport({ now: at, graphSecretExpires: "2028-10-04", events: [1, 2, 3].map(() => ({ at, area: "graph", severity: "error", message: "Microsoft sign-in failed", ref: null })) });
    expect(same.areas[0]).toMatchObject({ count: 3, latest: [{ message: "Microsoft sign-in failed", times: 3 }] });
  });
});
