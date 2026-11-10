import { afterEach, describe, expect, test, vi } from "vitest";
import { autofillBundleSpanish, autofillSettingsSpanish, fit, looksLikeCode, type Translate } from "@/lib/i18n/spanish-autofill";
import { spanishOwnerCopyIssues } from "@/i18n/publication-audit";
import { defaultSettings } from "@/lib/settings/defaults";
import type { SiteSettings } from "@/lib/settings/types";

/** Owner, Nov 9: whatever is added in /admin gets its Spanish filled in on save; Spanish typed by hand is kept. */

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    beta = { messages: { create: (...args: unknown[]) => create(...args) } };
  }
  return { default: Anthropic };
});


const fake: Translate = async (texts) => texts.map((t) => (looksLikeCode(t) ? t : `ES:${t}`));
const photo = (over: Record<string, unknown> = {}) => ({ id: "c225", src: "/portfolio/basket-nap.jpg", width: 900, height: 1200, title: "C225", alt: "Baby asleep in a basket", ...over });

function settingsWith(photos: ReturnType<typeof photo>[]): SiteSettings {
  const s = structuredClone(defaultSettings);
  s.media.default = { title: [], landing: [], about: [], email: [], landingPicks: [], sections: [{ id: "s1", photos: photos as never, prompt: true, promptPhotoId: null, title: "Book your session", text: "We bring the studio to you.", spanish: null }] };
  return s;
}

describe("Spanish fill-in: which words", () => {
  test("photo codes and file names stay as they are", () => {
    for (const code of ["C225", "IMG_7378", "IMG 6087", "DSC-0042", "photo_12.jpg", "7"]) expect(looksLikeCode(code)).toBe(true);
    for (const words of ["Basket nap", "Six month milestone", "Tummy time"]) expect(looksLikeCode(words)).toBe(false);
  });

  test("a translation longer than the field: the English if it fits, else cut at a word", () => {
    expect(fit("Corto", "Short", 10)).toBe("Corto");
    expect(fit("Una traducción bastante larga", "A long one", 12)).toBe("A long one");
    expect(fit("palabra palabra palabra palabra", "word word word word word word word", 20)).toBe("palabra palabra");
  });
});

describe("Spanish fill-in: settings (photos, prompt boxes, seasonal offers)", () => {
  test("a new photo, a prompt box and an offer get Spanish; Spanish typed by hand is kept", async () => {
    const s = settingsWith([photo(), photo({ id: "mine", title: "Basket nap", alt: "Baby in a basket", caption: "First week", spanish: { title: "Mi título", alt: "Mi descripción" } })]);
    s.seasonalOffers.firstChristmas = { ...s.seasonalOffers.firstChristmas, enabled: true, spanish: null };
    expect(spanishOwnerCopyIssues(s).length).toBeGreaterThan(0);

    const { settings, filled } = await autofillSettingsSpanish(s, fake);
    const theme = "default" as const;
    const [first, second] = settings.media[theme]!.sections![0].photos as ReturnType<typeof photo>[] & { spanish: { title: string; alt: string; caption?: string } }[];
    expect(first.spanish).toEqual({ title: "C225", alt: "ES:Baby asleep in a basket", caption: undefined });
    expect(second.spanish).toEqual({ title: "Mi título", alt: "Mi descripción", caption: "ES:First week" });
    expect(settings.media[theme]!.sections![0].spanish).toEqual({ title: "ES:Book your session", text: "ES:We bring the studio to you." });
    expect(settings.seasonalOffers.firstChristmas.spanish?.title).toBe(`ES:${s.seasonalOffers.firstChristmas.title}`);
    expect(filled).toBeGreaterThan(0);
    // nothing left that would hide the Spanish site
    expect(spanishOwnerCopyIssues(settings)).toEqual([]);
    // the input isn't changed (the route saves the returned copy)
    expect(s.seasonalOffers.firstChristmas.spanish).toBeNull();
  });

  test("everything already in Spanish: nothing is sent to translate", async () => {
    const translate = vi.fn(fake);
    const s = settingsWith([photo({ spanish: { title: "C225", alt: "Bebé en una canasta" } })]);
    const theme = "default" as const;
    s.media[theme]!.sections![0].spanish = { title: "Reserva", text: "Llevamos el estudio a ti." };
    for (const o of Object.values(s.seasonalOffers)) o.spanish = { title: "T", description: "D" };
    const { filled } = await autofillSettingsSpanish(s, translate);
    expect(filled).toBe(0);
    expect(translate).not.toHaveBeenCalled();
  });
});

describe("Spanish fill-in: bundles", () => {
  const bundle = { name: "Little Moments", description: "One hour, baby only", badge: "Most loved", features: ["Up to 1 hour", "Baby only", "8 edited digital photos"], offer: { enabled: true, price: 99, label: "Holiday price", endsOn: "2026-12-20" } };

  test("a bundle saved without Spanish gets all of it", async () => {
    expect(await autofillBundleSpanish({ ...bundle, spanish: null }, fake)).toMatchObject({
      spanish: { name: "ES:Little Moments", description: "ES:One hour, baby only", badge: "ES:Most loved", offerLabel: "ES:Holiday price", features: ["ES:Up to 1 hour", "ES:Baby only", "ES:8 edited digital photos"] },
    });
  });

  test("a new included item gets its Spanish; the ones typed by hand stay; a cleared English field clears its Spanish", async () => {
    const out = (await autofillBundleSpanish(
      { ...bundle, badge: "", features: [...bundle.features, "Sneak peek in 48 hours"], spanish: { name: "Pequeños momentos", description: "Una hora", badge: "La más pedida", offerLabel: "Precio navideño", features: ["Hasta 1 hora", "Solo bebé", "8 fotos editadas", ""] } },
      fake,
    )) as { spanish: Record<string, unknown> };
    expect(out.spanish).toEqual({ name: "Pequeños momentos", description: "Una hora", badge: null, offerLabel: "Precio navideño", features: ["Hasta 1 hora", "Solo bebé", "8 fotos editadas", "ES:Sneak peek in 48 hours"] });
  });

  test("whatever comes back passes the bundle check (no more 'translate every item' errors)", async () => {
    const { bundleInputSchema } = await import("@/lib/pricing/validation");
    const raw = { ...bundle, price: 149, durationMinutes: 60, photos: "8", active: true, extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 }, spanish: { name: "Pequeños", features: ["Hasta 1 hora"] } };
    expect(bundleInputSchema.safeParse(raw).success).toBe(false);
    expect(bundleInputSchema.safeParse(await autofillBundleSpanish(raw, fake)).success).toBe(true);
  });
});

describe("translator", () => {
  afterEach(() => {
    create.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("without a key: the English is copied, nothing is sent", async () => {
    const { toSpanish } = await import("@/lib/i18n/autotranslate");
    expect(await toSpanish(["Basket nap", "C225"])).toEqual(["Basket nap", "C225"]);
    expect(create).not.toHaveBeenCalled();
  });

  test("with a key: one request (codes left out, repeats once), fallbacks on, JSON back in order", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ translations: ["Siesta en la canasta", "Primera sonrisa"] }) }] });
    const { toSpanish, TRANSLATE_MODEL } = await import("@/lib/i18n/autotranslate");
    expect(await toSpanish(["Basket nap", "C225", "First smile", "Basket nap"])).toEqual(["Siesta en la canasta", "C225", "Primera sonrisa", "Siesta en la canasta"]);
    expect(create).toHaveBeenCalledTimes(1);
    const req = create.mock.calls[0][0];
    expect(req).toMatchObject({ model: TRANSLATE_MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low", format: { type: "json_schema" } } });
    expect(JSON.parse(req.messages[0].content)).toEqual(["Basket nap", "First smile"]);
  });

  test("a failure, a refusal or a wrong shape: the English is copied, the save goes on", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { toSpanish } = await import("@/lib/i18n/autotranslate");
    create.mockRejectedValueOnce(new Error("network down"));
    expect(await toSpanish(["Basket nap"])).toEqual(["Basket nap"]);
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    expect(await toSpanish(["Basket nap"])).toEqual(["Basket nap"]);
    create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ translations: [] }) }] });
    expect(await toSpanish(["Basket nap"])).toEqual(["Basket nap"]);
  });
});
