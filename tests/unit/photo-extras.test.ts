import { describe, expect, test, vi } from "vitest";
import { boughtFrom, NO_PURCHASES, priceOrder, whatsLeft } from "@/lib/photo-extras/math";
import type { ExtrasSettings } from "@/lib/photo-extras/types";
import { sneakPeekEmail } from "@/emails/AfterSession";
import { photoExtrasPaidEmail } from "@/emails/PhotoExtrasPaid";

vi.mock("server-only", () => ({}));

// the owner's prices (Nov 20); tests only: the live ones come from /admin → Pricing
const s: ExtrasSettings = { enabled: true, extraPhotoCents: 1300, maxExtras: 6, fullGalleryCents: 25000, rawFilesCents: 11500, openDays: 30, extrasDeliveryHours: 72, fullDeliveryDays: 7, rawDeliveryHours: 48 };

describe("photo extras price math (owner, Nov 20)", () => {
  test("4 extras + unedited files, prices and delivery promises copied into the lines", () => {
    const o = priceOrder(s, NO_PURCHASES, { extras: 4, full: false, raw: true });
    expect(o).toEqual({
      lines: [
        { kind: "extra_photos", quantity: 4, unitCents: 1300, totalCents: 5200, delivery: { amount: 72, unit: "hours" } },
        { kind: "unedited_files", quantity: 1, unitCents: 11500, totalCents: 11500, delivery: { amount: 48, unit: "hours" } },
      ],
      creditCents: 0,
      totalCents: 16700,
    });
  });

  test("the cap of 6 counts every earlier order", () => {
    const bought = boughtFrom([{ lines: [{ kind: "extra_photos", quantity: 4, unitCents: 1300, totalCents: 5200, delivery: { amount: 72, unit: "hours" } }] }]);
    expect(whatsLeft(s, bought).extrasLeft).toBe(2);
    expect(priceOrder(s, bought, { extras: 3, full: false, raw: false })).toEqual({ error: "too_many" });
    expect(priceOrder(s, bought, { extras: 2, full: false, raw: false })).toMatchObject({ totalCents: 2600 });
  });

  test("the full gallery drops extra photos and costs less what extras already paid", () => {
    expect(priceOrder(s, NO_PURCHASES, { extras: 3, full: true, raw: false })).toMatchObject({ lines: [{ kind: "full_gallery", totalCents: 25000 }], creditCents: 0, totalCents: 25000 });
    const bought = { ...NO_PURCHASES, extras: 4, extrasPaidCents: 5200 };
    expect(priceOrder(s, bought, { extras: 0, full: true, raw: true })).toMatchObject({ creditCents: 5200, totalCents: 25000 - 5200 + 11500 });
  });

  test("nothing chosen, or something already bought, can't be paid", () => {
    expect(priceOrder(s, NO_PURCHASES, { extras: 0, full: false, raw: false })).toEqual({ error: "nothing" });
    expect(priceOrder(s, { ...NO_PURCHASES, raw: true }, { extras: 0, full: false, raw: true })).toEqual({ error: "already" });
    const all = { ...NO_PURCHASES, full: true, raw: true };
    expect(whatsLeft(s, all)).toMatchObject({ extrasLeft: 0, canFull: false, canRaw: false, nothingLeft: true });
  });
});

describe("the extras link", () => {
  test("signed with its own purpose: a pay link's signature doesn't open it", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret-for-links");
    const { extrasUrl, verifyExtrasLink, bookingPayUrl } = await import("@/lib/payments/link");
    const url = new URL(extrasUrl("TH-20261205-4821", "es")!);
    expect(url.pathname).toBe("/es/extras");
    expect(verifyExtrasLink("TH-20261205-4821", url.searchParams.get("s")!)).toBe(true);
    expect(verifyExtrasLink("TH-20261205-4822", url.searchParams.get("s")!)).toBe(false);
    expect(verifyExtrasLink("TH-20261205-4821", new URL(bookingPayUrl("TH-20261205-4821")!).searchParams.get("s")!)).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("the emails", () => {
  const details = { reference: "TH-20261205-4821", parentName: "Sofia Martinez", babyName: "Mia", bundleName: "Our Little Story" };
  const base = { themeId: "default", galleryUrl: "https://example.com/g", favorites: "20", amountCents: 0, paid: true, images: "inline" as const };
  test("the sneak peek offers what's left, with the saved prices", async () => {
    const left = whatsLeft(s, NO_PURCHASES);
    const mail = await sneakPeekEmail(details, { ...base, extras: { url: "https://example.com/extras", left, prices: s } });
    expect(mail.text).toContain("Want more photos?\nLove more than 20? You can add more before we start editing:\n- Extra edited photos: $13 each, up to 6\n- Your full gallery, color-corrected and retouched: $250\n- Your unedited RAW files (every photo as taken): $115\nAdd photos: https://example.com/extras");
    expect(mail.html).toContain("Add photos");
    const none = await sneakPeekEmail(details, base);
    expect(none.text).not.toContain("Want more photos?");
  });

  test("the thank-you lists each line, when it arrives and what they paid", async () => {
    const o = priceOrder(s, { ...NO_PURCHASES, extras: 4, extrasPaidCents: 5200 }, { extras: 0, full: true, raw: true });
    if ("error" in o) throw new Error(o.error);
    const mail = await photoExtrasPaidEmail(details, { themeId: "thanksgiving", ...o, images: "inline", locale: "es" });
    expect(mail.text).toContain("Galería completa, con corrección de color y retoque: $250 · llega en 7 días");
    expect(mail.text).toContain("Archivos RAW sin editar: $115 · llega en 48 horas");
    expect(mail.text).toContain("Ya pagado por fotos extra: −$52");
    expect(mail.text).toContain("Pagado: $313");
  });
});
