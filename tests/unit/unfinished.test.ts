import { describe, expect, test } from "vitest";
import { unfinishedFollowUpEmail } from "@/emails/UnfinishedBooking";
import { periodOf } from "@/lib/unfinished/period";
import { draftStage, dueDraftStage, funnelSummary, mergeDraft, needsFollowUp, reasonSummary } from "@/lib/unfinished/summary";
import { looksLikeEmail } from "@/lib/unfinished/client";

const at = (iso: string) => new Date(iso);

describe("unfinished bookings: where a draft stands", () => {
  test("no booking: the step they reached", () => {
    expect(draftStage("details", null)).toBe("details");
    expect(draftStage("review", null)).toBe("review");
  });
  test("booked families are hidden; an unpaid deposit counts as unfinished; a later cancellation doesn't", () => {
    expect(draftStage("review", { status: "confirmed", cancellationReason: null })).toBe("booked");
    expect(draftStage("review", { status: "pending", cancellationReason: null })).toBe("booked");
    expect(draftStage("review", { status: "cancelled", cancellationReason: "Deposit not paid (the payment page expired, so the time was released)" })).toBe("deposit");
    expect(draftStage("review", { status: "cancelled", cancellationReason: "We moved away" })).toBe("cancelled");
  });
});

describe("unfinished bookings: a new save on an existing draft", () => {
  const base = { step: "details", attempts: 1, updatedAt: at("2026-11-03T15:00:00Z"), bookedAt: null };
  test("keeps the furthest step of the same visit", () => {
    expect(mergeDraft({ ...base, step: "review" }, { step: "details", at: at("2026-11-03T15:05:00Z") })).toEqual({ action: "update", step: "review", attempts: 1, clearBooking: false });
    expect(mergeDraft(base, { step: "review", at: at("2026-11-03T15:05:00Z") })).toMatchObject({ step: "review", attempts: 1 });
  });
  test("a late save right after booking is ignored", () => {
    expect(mergeDraft({ ...base, bookedAt: at("2026-11-03T15:10:00Z") }, { step: "review", at: at("2026-11-03T16:00:00Z") })).toEqual({ action: "ignore" });
  });
  test("coming back long after booking, or after a week, is a new visit", () => {
    expect(mergeDraft({ ...base, bookedAt: at("2026-11-01T15:00:00Z") }, { step: "details", at: at("2026-11-03T15:00:00Z") })).toEqual({ action: "update", step: "details", attempts: 2, clearBooking: true });
    expect(mergeDraft({ ...base, step: "review" }, { step: "details", at: at("2026-11-11T15:00:00Z") })).toEqual({ action: "update", step: "details", attempts: 2, clearBooking: false });
  });
});

describe("unfinished bookings: step counts and answers", () => {
  const rows = [
    { step: "calendar", source: "Meta ads", count: 12 },
    { step: "calendar", source: "Direct", count: 3 },
    { step: "date", source: "Meta ads", count: 7 },
    { step: "time", source: "Meta ads", count: 4 },
    { step: "details", source: "Direct", count: 1 },
    { step: "booked", source: "Direct", count: 1 },
    { step: "calendar", source: "Meta ads", count: 2 },
  ];
  test("adds up each step in form order, for every source or one", () => {
    expect(funnelSummary(rows, 30, null).steps).toEqual([
      { step: "calendar", count: 17 },
      { step: "date", count: 7 },
      { step: "time", count: 4 },
      { step: "details", count: 1 },
      { step: "booked", count: 1 },
    ]);
    expect(funnelSummary(rows, 30, "Meta ads").steps.map((s) => s.count)).toEqual([14, 7, 4, 0, 0]);
    expect(funnelSummary(rows, 30, null).sources).toEqual(["Meta ads", "Direct"]);
  });
  test("counts each family's reasons once, most picked first", () => {
    const feedback = (reasons: string[]) => ({ feedback: { reasons: reasons as never[], comment: null, at: "2026-11-03T15:00:00Z" } });
    expect(reasonSummary([feedback(["travel_fee", "price"]), feedback(["travel_fee", "travel_fee"]), { feedback: null }, feedback(["bogus"])])).toEqual({
      reasons: [{ reason: "travel_fee", count: 2 }, { reason: "price", count: 1 }],
      answered: 3,
    });
  });
  test("'Send to everyone' skips families already emailed or unsubscribed", () => {
    expect(needsFollowUp({ followUp: null, unsubscribed: false })).toBe(true);
    expect(needsFollowUp({ followUp: { status: "failed", at: null, error: "x" }, unsubscribed: false })).toBe(false);
    expect(needsFollowUp({ followUp: null, unsubscribed: true })).toBe(false);
  });
  test("the period defaults to 7 days and only allows 7, 30 or 90", () => {
    expect(periodOf(new URL("https://x.test/a"))).toEqual({ days: 7, source: null });
    expect(periodOf(new URL("https://x.test/a?days=30&source=Meta%20ads"))).toEqual({ days: 30, source: "Meta ads" });
    expect(periodOf(new URL("https://x.test/a?days=365"))).toEqual({ days: 7, source: null });
  });
  test("half-typed emails aren't saved", () => {
    expect(looksLikeEmail("maria@gmail.com")).toBe(true);
    expect(looksLikeEmail("maria@gmail")).toBe(false);
    expect(looksLikeEmail("maria@gmail.c")).toBe(false);
    expect(looksLikeEmail("maria@")).toBe(false);
  });
});

describe("'What stopped you?' email", () => {
  const opts = {
    themeId: "default",
    feedbackUrl: "https://www.tinyhumans.photography/feedback?t=abc",
    bookUrl: "https://www.tinyhumans.photography/book?bundle=little-moments",
    unsubscribeUrl: "https://www.tinyhumans.photography/unsubscribe?t=abc",
    mailingAddress: "PO Box 123, Miami Beach, FL 33139",
    images: "inline" as const,
  };
  test("has the marketing footer the law requires: it's an ad, why they got it, address, unsubscribe", async () => {
    const mail = await unfinishedFollowUpEmail({ parentName: "Ana Lopez", bundleName: "Little Moments" }, opts);
    expect(mail.subject).toBe("Did something stop you, Ana?");
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("This is a marketing email from Tiny Humans.");
      expect(part).toContain("PO Box 123, Miami Beach, FL 33139");
      expect(part).toContain(opts.unsubscribeUrl);
      expect(part).toContain(opts.feedbackUrl);
      expect(part).toContain(opts.bookUrl);
      expect(part).toContain("Little Moments");
    }
  });
  test("in Spanish, and without a name or bundle", async () => {
    const es = await unfinishedFollowUpEmail({ parentName: "Lucía", bundleName: null }, { ...opts, locale: "es" });
    expect(es.subject).toBe("¿Algo te detuvo, Lucía?");
    expect(es.html).toContain("Este es un correo de marketing de Tiny Humans.");
    expect(es.html).toContain("Cancelar suscripción");
    const noName = await unfinishedFollowUpEmail({ parentName: "", bundleName: null }, opts);
    expect(noName.subject).toBe("Did something stop you?");
    expect(noName.text).toContain("started booking a session");
  });
});

describe("unfinished bookings from \"Not born yet?\" (owner, Nov 11)", () => {
  test("a due-date reservation: hidden while its deposit page is open or once reserved; shown when the deposit ran out", () => {
    expect(dueDraftStage("pending")).toBe("booked");
    expect(dueDraftStage("reserved")).toBe("booked");
    expect(dueDraftStage("scheduled")).toBe("booked");
    expect(dueDraftStage("expired")).toBe("deposit");
    expect(dueDraftStage("cancelled")).toBe("cancelled");
  });
});
