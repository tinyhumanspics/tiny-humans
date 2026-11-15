import { beforeEach, describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import { requestDeclinedEmail } from "@/emails/RequestDeclined";
import { formatAddress } from "@/lib/booking/templates";
import { babiesLabel } from "@/lib/booking/extra-babies";
import { claimRequest, declineRequest, insertRequest, linkRequest, markRequestBooked, requestById, unclaimRequest, type NewRequestRow } from "@/lib/requests/store";
import { confirmText, helloText, requestWhenText } from "@/lib/requests/texts";

// /admin → Requests (brief 02, part 2): the texts the owner sends, and each request's way from new to booked or declined.
vi.mock("server-only", () => ({}));

const base: NewRequestRow = {
  reference: "TH-R-20261114-1234",
  clientId: "c1",
  type: "date",
  bundleId: "our-little-story",
  bundleName: "Our Little Story",
  bundleCents: 26910,
  totalCents: 26910,
  pricing: {},
  slotDate: "2026-11-21",
  slotStart: "09:00",
  startsAt: new Date("2026-11-21T14:00:00Z"),
  endsAt: new Date("2026-11-21T16:00:00Z"),
  holdUntil: new Date("2026-11-15T03:00:00Z"),
  firstName: "Ana",
  mobile: "+13055550142",
  email: "ana@example.com",
  zip: "33139",
};

describe("the owner's texts", () => {
  it("Confirm: the day, the time, the deposit and the link, in the request's language", () => {
    const link = "https://www.tinyhumans.photography/book?bundle=our-little-story&deposit=TH-1&k=x";
    expect(confirmText({ name: "Ana", locale: "en", slot: { date: "2026-11-21", start: "09:00" }, depositCents: 5000, link })).toBe(
      `Hi Ana, you're confirmed for Saturday, November 21, 2026, 9:00 am. Here's the link to hold it with the $50 deposit: ${link}`,
    );
    const es = confirmText({ name: "Ana", locale: "es", slot: { date: "2026-11-21", start: "09:00" }, depositCents: 5000, link });
    expect(es).toMatch(/^Hola Ana, tu sesión está confirmada para sábado/);
    expect(es).toContain("depósito de $50");
    expect(es.endsWith(link)).toBe(true);
  });

  it("a due date has its own wording; nothing to pay says it's booked", () => {
    expect(confirmText({ name: "Ana", locale: "en", due: { date: "2026-12-20" }, depositCents: 5000, link: "https://x/due" })).toBe(
      "Hi Ana, your spot for your due date (Sunday, December 20, 2026) is saved. Here's the link to hold it with the $50 deposit: https://x/due",
    );
    expect(confirmText({ name: "Ana", locale: "en", slot: { date: "2026-11-21", start: "09:00" }, depositCents: 0, link: null })).toBe("Hi Ana, you're booked for Saturday, November 21, 2026, 9:00 am! Your confirmation is in your email.");
    expect(confirmText({ name: "Ana", locale: "es", due: { date: "2026-12-20" }, depositCents: 0, link: null })).toMatch(/quedó reservado/);
  });

  it("Text: a hello about their request", () => {
    expect(helloText("Ana", requestWhenText({ type: "due_date", slotDate: null, slotStart: null, dueDate: "2026-12-20" }, "en"), "en")).toBe(
      "Hi Ana! This is Tiny Humans about your session request for your due date (Sunday, December 20, 2026).",
    );
  });

  it("the decline email is kind and asks them to text for another day (EN/ES)", async () => {
    const en = await requestDeclinedEmail({ firstName: "Ana", when: "Saturday, November 21, 2026, 9:00 am" }, { themeId: "default", locale: "en", images: "inline" });
    expect(en.subject).toBe("About your session request");
    expect(en.text).toContain("Thank you for your request for Saturday, November 21, 2026, 9:00 am.");
    expect(en.text).toContain(site.contact.phone);
    const es = await requestDeclinedEmail({ firstName: "Ana", when: "sábado" }, { themeId: "default", locale: "es", images: "inline" });
    expect(es.subject).toBe("Sobre tu solicitud de sesión");
  });
});

describe("a request's way through /admin (kept in memory without a database)", () => {
  beforeEach(() => {
    (globalThis as { __thBookingRequests?: unknown[] }).__thBookingRequests = [];
  });

  it("Confirm claims it once (its hold stops counting), then the booking's deposit makes it booked", async () => {
    const row = await insertRequest(base);
    expect((await claimRequest(row.id))?.status).toBe("confirmed");
    expect(await claimRequest(row.id)).toBeNull(); // a second tap can't book twice
    await linkRequest(row.id, { bookingId: "b-1" }, "confirmed");
    await unclaimRequest(row.id); // a late failure can't undo a linked request
    expect((await requestById(row.id))?.status).toBe("confirmed");
    await markRequestBooked({ bookingId: "b-other" });
    expect((await requestById(row.id))?.status).toBe("confirmed");
    await markRequestBooked({ bookingId: "b-1" });
    expect(await requestById(row.id)).toMatchObject({ status: "booked", bookingId: "b-1" });
    expect(await declineRequest(row.id)).toBeNull();
  });

  it("a failed confirm gives it back; Decline ends it", async () => {
    const row = await insertRequest({ ...base, clientId: "c2", reference: "TH-R-20261114-5678" });
    await claimRequest(row.id);
    await unclaimRequest(row.id);
    expect((await requestById(row.id))?.status).toBe("new");
    expect((await declineRequest(row.id))?.status).toBe("declined");
    expect(await claimRequest(row.id)).toBeNull();
  });

  it("a due-date reservation's deposit makes its request booked", async () => {
    const row = await insertRequest({ ...base, clientId: "c3", reference: "TH-R-20261114-9999", type: "due_date", slotDate: null, slotStart: null, startsAt: null, endsAt: null, holdUntil: null, dueDate: "2026-12-20" });
    await claimRequest(row.id);
    await linkRequest(row.id, { dueId: "d-1" }, "confirmed");
    await markRequestBooked({ dueId: "d-1" });
    expect((await requestById(row.id))?.status).toBe("booked");
  });
});

describe("a booking made from a request (street and baby's age still to come)", () => {
  it("shows the ZIP code alone, and no empty age", () => {
    expect(formatAddress({ street: "", city: "", zip: "33139" })).toBe("FL 33139");
    expect(formatAddress({ street: "1500 Bay Rd", unit: "4", city: "Miami Beach", zip: "33139" })).toBe("1500 Bay Rd, Unit 4, Miami Beach, FL 33139");
    expect(babiesLabel([{ age: "" }, { age: "", name: "Mia" }])).toBe("Baby 1, Mia");
    expect(babiesLabel([{ age: "2–6 weeks", name: "Leo" }])).toBe("Leo (2–6 weeks)");
  });
});
