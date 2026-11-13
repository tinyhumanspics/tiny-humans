import { describe, expect, test } from "vitest";
import { ownerBookedEmail, ownerBookedSms } from "@/emails/OwnerBooked";
import { ownerRulesOf } from "@/lib/booking/availability";
import { isOwnerBooked, OWNER_HOLD_HOURS, payPageWindow } from "@/lib/deposit/types";

/** /admin → Quotes / Booking (owner, Nov 12): sessions the owner books for a family who texted. */
const H = 3_600_000;
const now = new Date("2026-11-12T20:00:00Z");

describe("owner bookings: the hold and the payment page", () => {
  test("held 48 hours; marked by their request id", () => {
    expect(OWNER_HOLD_HOURS).toBe(48);
    expect(isOwnerBooked({ requestId: "owner-1a2b3c4d" })).toBe(true);
    expect(isOwnerBooked({ requestId: "1a2b3c4d-booking-form" })).toBe(false);
    expect(isOwnerBooked({ requestId: null })).toBe(false);
  });

  test("the Stripe page opened from the family's link closes with the hold, within Stripe's 30 min – 24 h", () => {
    // 48 h left: the page closes in 24 h (Stripe's longest); the hold stays 48 h (Pay again opens a new page)
    const long = payPageWindow(new Date(now.getTime() + 48 * H), now);
    expect(long.expiresAt.getTime()).toBe(now.getTime() + (24 * 60 - 1) * 60_000);
    expect(long.holdUntil.getTime()).toBe(now.getTime() + 48 * H);
    // 5 h left: the page closes with the hold
    const mid = payPageWindow(new Date(now.getTime() + 5 * H), now);
    expect(mid.expiresAt.getTime()).toBe(now.getTime() + 5 * H);
    expect(mid.holdUntil.getTime()).toBe(now.getTime() + 5 * H);
    // 10 min left: Stripe needs 30 min, so the page gets 31 and the hold follows (never a page without a hold)
    const short = payPageWindow(new Date(now.getTime() + 10 * 60_000), now);
    expect(short.expiresAt.getTime()).toBe(now.getTime() + 31 * 60_000);
    expect(short.holdUntil.getTime()).toBe(short.expiresAt.getTime());
  });

  test("the owner's calendar ignores the online minimum notice (nothing else)", () => {
    const rules = { limits: { minimumNoticeDays: 2, maxSessionsPerDay: 3 }, weekly: "same" };
    expect(ownerRulesOf(rules)).toEqual({ limits: { minimumNoticeDays: 0, maxSessionsPerDay: 3 }, weekly: "same" });
    expect(rules.limits.minimumNoticeDays).toBe(2);
  });
});

describe("owner bookings: the family's email and the text to copy", () => {
  const d = { parentName: "Ana Rivera", bundleName: "Our Little Story", date: "2026-11-20", start: "12:00", untilDate: "2026-11-14", untilTime: "20:12", amountCents: 5000 };
  const url = "https://www.tinyhumans.photography/book?bundle=our-little-story&deposit=TH-20261112-4459&k=sig";

  test("English: saved, two steps, held until a day and time, one button to their link", async () => {
    const mail = await ownerBookedEmail(d, { themeId: "default", url });
    expect(mail.subject).toBe("We saved your Tiny Humans session");
    expect(mail.text).toContain("We saved your session, Ana!");
    expect(mail.text).toContain("Our Little Story on Friday, November 20, 2026 at 12:00 pm, at your home. To confirm it: pick your backdrop, then pay the $50 deposit.");
    expect(mail.text).toContain("We're holding this time for you until Saturday, November 14, 2026, 8:12 pm (Miami time).");
    expect(mail.text).toContain(`Finish your booking: ${url}`);
    expect(mail.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
    expect(mail.html).toContain("Finish my booking");
    expect(mail.html).not.toMatch(/Ana<!-- -->/);
  });

  test("Spanish email and both texts", async () => {
    const mail = await ownerBookedEmail(d, { themeId: "thanksgiving", url, locale: "es" });
    expect(mail.subject).toBe("Guardamos tu sesión de Tiny Humans");
    expect(mail.text).toContain("¡Guardamos tu sesión, Ana!");
    expect(mail.html).toContain("Terminar mi reserva");
    expect(ownerBookedSms(d, url, "en")).toBe(`Hi Ana! We saved Friday, November 20, 2026 at 12:00 pm for your Tiny Humans session. Pick your backdrop and pay the $50 deposit to confirm it here: ${url}`);
    expect(ownerBookedSms(d, url, "es")).toMatch(/^¡Hola Ana! Guardamos el viernes, 20 de noviembre de 2026 a las 12:00 p\. m\./);
  });
});
