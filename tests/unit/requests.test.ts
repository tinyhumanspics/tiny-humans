import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingRequestRow } from "@/lib/db/schema";
import { heldIntervals, holdUntil, isHeld } from "@/lib/requests/holds";
import { formatUsMobile, usMobile } from "@/lib/requests/types";
import { requestSchema } from "@/lib/requests/validation";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

// Booking requests (brief 02): the 4 boxes, the 12-hour hold, and both emails (Resend faked).
const h = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text?: string; scope: string; replyTo?: string }[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/resend", () => ({
  emailConfig: () => ({ apiKey: "re_test", from: "Tiny Humans <hello@tinyhumans.photography>", internalFrom: "no-reply <hello@tinyhumans.photography>", notify: "hello@tinyhumans.photography" }),
  sendEmail: vi.fn(async (e: { to: string; subject: string; text?: string; scope: string }) => {
    h.sent.push(e);
    return { id: "msg" };
  }),
}));
vi.mock("@/lib/pricing/server", () => ({ getPublicCatalog: async (locale: string) => ({ status: "live", bundles: [{ id: "our-little-story", name: locale === "es" ? "Nuestra pequeña historia" : "Our Little Story" }] }) }));
vi.mock("@/lib/settings/server", () => ({ getSiteSettings: async () => ({ themeId: "default" }) }));
vi.mock("@/lib/deposit/server", () => ({ depositOfferFor: async () => 5000 }));

const row = (over: Partial<BookingRequestRow> = {}): BookingRequestRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  reference: "TH-R-20261114-1234",
  clientId: "client-0001",
  createdAt: new Date("2026-11-14T15:00:00Z"),
  updatedAt: new Date("2026-11-14T15:00:00Z"),
  locale: "en",
  type: "date",
  status: "new",
  bundleId: "our-little-story",
  bundleName: "Our Little Story",
  babyCount: 1,
  bundleCents: 24900,
  addonsCents: 0,
  totalCents: 24900,
  pricing: {},
  slotDate: "2026-12-08",
  slotStart: "10:00",
  startsAt: new Date("2026-12-08T15:00:00Z"),
  endsAt: new Date("2026-12-08T17:00:00Z"),
  dueDate: null,
  holdUntil: new Date("2026-11-15T03:00:00Z"),
  firstName: "Dana",
  mobile: "+13055550122",
  email: "dana@example.com",
  zip: "33139",
  travelStatus: "free",
  travelMiles: 6,
  travelFeeCents: 0,
  textConsent: true,
  consentVersion: "2026-11-14",
  bookingId: null,
  dueId: null,
  inspirationId: null,
  ...over,
});

beforeEach(() => {
  h.sent.length = 0;
});

describe("the four boxes", () => {
  const ok = { clientId: "client-0001", locale: "en", type: "date", bundleId: "our-little-story", babyCount: 1, slot: { date: "2026-12-08", start: "10:00" }, firstName: "Dana", mobile: "(305) 555-0122", email: "Dana@Example.com", zip: "33139", textConsent: false };
  it("accepts a US mobile in any common shape, and a lower-cased email", () => {
    const r = requestSchema.parse(ok);
    expect(r.email).toBe("dana@example.com");
    expect(usMobile("305-555-0122")).toBe("+13055550122");
    expect(usMobile("+1 (305) 555 0122")).toBe("+13055550122");
    expect(formatUsMobile("+13055550122")).toBe("(305) 555-0122");
  });
  it("refuses a short or fake number, a bad ZIP, and a missing time or due date", () => {
    expect(usMobile("555-0122")).toBeNull();
    expect(usMobile("(055) 555-0122")).toBeNull();
    expect(requestSchema.safeParse({ ...ok, zip: "3313" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...ok, slot: undefined }).success).toBe(false);
    expect(requestSchema.safeParse({ ...ok, type: "due_date", slot: undefined, dueDate: "2027-02-01" }).success).toBe(true);
  });
});

describe("the 12-hour hold", () => {
  const created = new Date("2026-11-14T15:00:00Z");
  const held = { type: "date", status: "new", startsAt: new Date("2026-12-08T15:00:00Z"), endsAt: new Date("2026-12-08T17:00:00Z"), holdUntil: holdUntil(created) };
  it("keeps the time from other families for 12 hours, then lets it go by itself", () => {
    expect(held.holdUntil.toISOString()).toBe("2026-11-15T03:00:00.000Z");
    expect(isHeld(held, new Date("2026-11-15T02:59:00Z"))).toBe(true);
    expect(isHeld(held, new Date("2026-11-15T03:00:00Z"))).toBe(false);
  });
  it("only new 'Baby is here' requests hold a time", () => {
    const now = new Date("2026-11-14T16:00:00Z");
    expect(heldIntervals([held, { ...held, status: "confirmed" }, { ...held, type: "due_date" }], now)).toEqual([{ start: held.startsAt, end: held.endsAt }]);
  });
});

describe("the emails", () => {
  it("the owner gets 'New request' at once and the parent 'Request received' with the 3 next steps", async () => {
    const { sendRequestEmails } = await import("@/lib/requests/server");
    await sendRequestEmails(row());
    expect(h.sent.map((e) => e.scope)).toEqual(["resend.request_owner", "resend.request_received"]);
    const [owner, parent] = h.sent;
    expect(owner).toMatchObject({ to: "hello@tinyhumans.photography", replyTo: "dana@example.com" });
    expect(owner.subject).toBe("New request: Dana · Tuesday, December 8, 2026, 10:00 am · Our Little Story");
    expect(owner.text).toContain("Mobile: (305) 555-0122");
    expect(owner.text).toContain("OK to text: Yes");
    expect(parent).toMatchObject({ to: "dana@example.com", subject: "We got your request" });
    expect(parent.text).toContain("We'll text you at (305) 555-0122 within minutes (8 a.m.–8 p.m.) to confirm Tuesday, December 8, 2026, 10:00 am.");
    expect(parent.text).toContain("2) A $50 link holds your date.");
    expect(parent.text).toContain("Nothing to pay now.");
  });
  it("in Spanish, with the translated bundle, and the due date for 'Not born yet'", async () => {
    const { sendRequestEmails } = await import("@/lib/requests/server");
    await sendRequestEmails(row({ locale: "es", type: "due_date", slotDate: null, slotStart: null, startsAt: null, endsAt: null, holdUntil: null, dueDate: "2027-02-01" }));
    const parent = h.sent[1];
    expect(parent.subject).toBe(es.emails.requestReceived.subject);
    expect(parent.text).toContain("Nuestra pequeña historia");
    expect(parent.text).toContain("para confirmar tu fecha de parto (");
    expect(h.sent[0].subject).toMatch(/^New request: Dana · due .* · Our Little Story$/);
  });
  it("English and Spanish have the same keys", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(es.bookingRequest)).toEqual(keys(en.bookingRequest));
    expect(keys(es.emails.requestReceived)).toEqual(keys(en.emails.requestReceived));
  });
});
