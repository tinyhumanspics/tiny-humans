import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const marks = vi.hoisted(() => ({ delivered: vi.fn(async () => 1), problem: vi.fn(async () => undefined) }));
vi.mock("@/lib/email/sent-log", async (original) => ({ ...(await original<typeof import("@/lib/email/sent-log")>()), markDelivered: marks.delivered, markProblem: marks.problem }));

const { emailNameOf, handleResendEvent } = await import("@/lib/email/delivery");
const { isFamilyEmail } = await import("@/lib/email/sent-log");

/** Every sendEmail scope in the code (the two template ones spelled out). */
function scopesInCode(): string[] {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));
  const found = ["lib", "app"].flatMap(files).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/scope: "(resend\.[\w-]+)"/g)].map((m) => m[1]));
  return [...new Set([...found, "resend.after_session", "resend.gallery_delivered", "resend.reminder-72h", "resend.reminder-24h"])];
}

describe("emails sent to a family, on their lead (owner, Nov 20)", () => {
  test("only the family's emails are listed, never the studio's own or the alerts", () => {
    expect(isFamilyEmail("resend.customer")).toBe(true);
    expect(isFamilyEmail("resend.request_received")).toBe(true);
    expect(isFamilyEmail("resend.internal")).toBe(false);
    expect(isFamilyEmail("resend.internal-reschedule")).toBe(false);
    expect(isFamilyEmail("resend.request_owner")).toBe(false);
    expect(isFamilyEmail("monitoring.alert")).toBe(false);
  });

  test("every family email has a name in the list", () => {
    const family = scopesInCode().filter(isFamilyEmail);
    expect(family.length).toBeGreaterThan(15);
    for (const scope of family) expect([scope, emailNameOf(scope.replace(/[^a-zA-Z0-9_-]/g, "_"))]).not.toEqual([scope, "email"]);
  });

  test("Resend's email.delivered marks that email as delivered", async () => {
    const out = await handleResendEvent({ type: "email.delivered", created_at: "2026-11-20T15:04:00.000Z", data: { email_id: "re_123", to: ["Mia@Example.com"] } }, "msg_1");
    expect(out).toEqual({ saved: 1 });
    expect(marks.delivered).toHaveBeenCalledWith("re_123", new Date("2026-11-20T15:04:00.000Z"));
    expect(marks.problem).not.toHaveBeenCalled();
  });
});
