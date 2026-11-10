import { describe, expect, test } from "vitest";
import { activeOffer, computeQuote, offerPercent, percentOffCents } from "@/lib/pricing/engine";
import { promoLine, promoSummary } from "@/lib/pricing/promo";
import { offerForAllSchema } from "@/lib/pricing/validation";
import { zipFromText, type QuoteLine } from "@/lib/quotes/types";
import { quoteMessage } from "@/lib/quotes/message";
import { addMonthsToKey, dueWindow } from "@/lib/due-date/types";
import { dueRequestSchema } from "@/lib/due-date/validation";
import { withAddons } from "@/lib/booking/extra-babies";
import { bookingRequestSchema } from "@/lib/booking/validation";
import type { Bundle } from "@/lib/pricing/types";
import type { TravelQuote } from "@/lib/travel/types";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const bundle = (id: string, name: string, price: number, offer?: Bundle["offer"]): Bundle => ({
  id, name, price, duration: "Up to 1 hour", durationMinutes: 60, people: "", setups: "", photos: "5–8", features: [], locationNote: "", cta: "", active: true, offer,
  extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
});
const pct = (b: Bundle, p: number, label = "Thanksgiving offer", endsOn = "2026-11-30"): Bundle => ({ ...b, offer: { enabled: true, price: percentOffCents(Math.round(b.price * 100), p) / 100, label, endsOn } });
const three = [bundle("lm", "Little Moments", 149), bundle("ls", "Our Little Story", 249), bundle("fs", "Our Family Story", 399)];
const list = (names: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names);
const date = (key: string) => ({ "2026-11-30": "November 30, 2026", "2026-12-24": "December 24, 2026" })[key] ?? key;

describe("percent-off offers (owner, Nov 10)", () => {
  test("exact cents, like a percentage discount code", () => {
    expect(percentOffCents(14900, 10)).toBe(13410);
    expect(percentOffCents(24900, 10)).toBe(22410);
    expect(percentOffCents(39900, 10)).toBe(35910);
    expect(percentOffCents(39900, 15)).toBe(33915);
  });

  test("a price that is exactly a whole percent off reads as that percent; any other price doesn't", () => {
    expect(offerPercent(14900, 13410)).toBe(10);
    expect(offerPercent(39900, 33915)).toBe(15);
    expect(offerPercent(39900, 34900)).toBeNull();
    expect(offerPercent(39900, 39900)).toBeNull();
    expect(offerPercent(39900, 0)).toBeNull();
    expect(offerPercent(10000, 5000)).toBe(50);
    expect(offerPercent(10000, 500)).toBeNull(); // 95% is over the 90% limit
  });

  test("the active offer carries its percent, and the booking price is the same exact cents", () => {
    const b = pct(three[0], 10);
    expect(activeOffer(b, "2026-11-10")).toMatchObject({ cents: 13410, percent: 10, label: "Thanksgiving offer" });
    expect(activeOffer(b, "2026-12-01")).toBeNull();
    expect(computeQuote(b, "2026-11-10")).toMatchObject({ finalCents: 13410, pricingType: "offer" });
    // twins stay full price on top of the offer
    expect(withAddons(computeQuote(b, "2026-11-10"), b, 2).totalCents).toBe(13410 + 7500);
  });

  test("the offer-for-every-bundle form: whole percent 1 to 90, a real last day", () => {
    expect(offerForAllSchema.safeParse({ percent: 10, label: "Thanksgiving offer", endsOn: "2026-11-30" }).success).toBe(true);
    expect(offerForAllSchema.safeParse({ percent: 0, endsOn: "2026-11-30" }).success).toBe(false);
    expect(offerForAllSchema.safeParse({ percent: 95, endsOn: "2026-11-30" }).success).toBe(false);
    expect(offerForAllSchema.safeParse({ percent: 12.5, endsOn: "2026-11-30" }).success).toBe(false);
    expect(offerForAllSchema.safeParse({ percent: 10, endsOn: "2026-02-31" }).success).toBe(false);
  });
});

describe("the offer line under the Bundles heading", () => {
  test("no offers: no line (the page looks exactly as before)", () => {
    expect(promoSummary(three, "2026-11-10")).toBeNull();
  });

  test("the same percent on every bundle", () => {
    const s = promoSummary(three.map((b) => pct(b, 10)), "2026-11-10")!;
    expect(s).toEqual({ label: "Thanksgiving offer", percent: 10, endsOn: "2026-11-30", names: null });
    expect(promoLine(s, en.bundlesPage.promo, list, date)).toBe("Thanksgiving offer: 10% off every bundle. Book by November 30, 2026.");
  });

  test("some bundles, and price offers without a shared percent", () => {
    const some = promoSummary([pct(three[0], 10), three[1], pct(three[2], 10)], "2026-11-10")!;
    expect(promoLine(some, en.bundlesPage.promo, list, date)).toBe("Thanksgiving offer: 10% off Little Moments and Our Family Story. Book by November 30, 2026.");
    const prices = promoSummary([{ ...three[0], offer: { enabled: true, price: 129, label: "Holiday offer", endsOn: "2026-12-24" } }, { ...three[1], offer: { enabled: true, price: 199, label: "Holiday offer", endsOn: "2026-12-24" } }, three[2]], "2026-11-10")!;
    expect(promoLine(prices, en.bundlesPage.promo, list, date)).toBe("Holiday offer on Little Moments and Our Little Story. Book by December 24, 2026.");
    const mixed = promoSummary([pct(three[0], 10, "A"), pct(three[1], 15, "B"), pct(three[2], 10, "A", "2026-12-24")], "2026-11-10")!;
    expect(promoLine(mixed, en.bundlesPage.promo, list, date)).toBe("Special offer on every bundle.");
  });

  test("Spanish", () => {
    const s = promoSummary(three.map((b) => pct(b, 10, "Oferta de Acción de Gracias")), "2026-11-10")!;
    expect(promoLine(s, es.bundlesPage.promo, list, () => "30 de noviembre de 2026")).toBe("Oferta de Acción de Gracias: 10% de descuento en todos los paquetes. Reserva hasta el 30 de noviembre de 2026.");
  });

  test("the offer is gone the day after its last day", () => {
    expect(promoSummary(three.map((b) => pct(b, 10)), "2026-12-01")).toBeNull();
  });
});

describe("Quotes: the ZIP code in a pasted address", () => {
  test.each([
    ["33326", "33326"],
    ["1234 Main St, Weston, FL 33326", "33326"],
    ["1234 Main St, Weston, FL 33326-1234", "33326"],
    ["12345 SW 8th St, Miami, FL 33175", "33175"],
    ["305-555-1234", null],
    ["Weston, FL", null],
    ["", null],
  ])("%s → %s", (text, zip) => {
    expect(zipFromText(text)).toBe(zip);
  });
});

describe("Quotes: the message to send", () => {
  const travel = (status: TravelQuote["status"], feeCents = 0): TravelQuote => ({ status, miles: 40, feeCents, freeMiles: 20, perMileCents: 100, maxMiles: 250 });
  const line = (over: Partial<QuoteLine>): QuoteLine => ({ bundleId: "lm", name: "Little Moments", bundleCents: 14900, regularCents: 14900, offerLabel: null, addons: [], travelCents: 0, totalCents: 14900, depositCents: 5000, unavailable: null, ...over });

  test("offer + travel fee + deposit", () => {
    const text = quoteMessage(
      {
        zip: "33326",
        lines: [line({ bundleCents: 13410, offerLabel: "Thanksgiving offer", travelCents: 2000, totalCents: 15410 }), line({ bundleId: "x", name: "Triplets only", unavailable: "No triplets option" })],
        travel: travel("fee", 2000),
        offerLine: "Thanksgiving offer: 10% off every bundle. Book by November 30, 2026.",
        deposit: { cents: 5000, varies: false },
        link: "https://www.tinyhumans.photography/bundles",
      },
      en.quoteMessage,
    );
    expect(text).toBe(
      [
        "Hi! Here are our prices for a session at your home (ZIP code 33326):",
        "",
        "• Little Moments: $154.10 (Thanksgiving offer $134.10 + $20 travel fee)",
        "",
        "Thanksgiving offer: 10% off every bundle. Book by November 30, 2026.",
        "A $50 deposit holds your date, and the rest is paid after your session.",
        "See what's in each bundle and book here: https://www.tinyhumans.photography/bundles",
      ].join("\n"),
    );
  });

  test("no travel fee, twins, no offer, deposits off (Spanish)", () => {
    const twins = { kind: "extra_baby" as const, name: "Extra baby", quantity: 1, unitPriceCents: 7500, totalCents: 7500, extraMinutes: 30, extraPhotos: 5 };
    const text = quoteMessage({ zip: "33139", lines: [line({}), line({ addons: [twins], totalCents: 22400 })], travel: travel("free"), offerLine: null, deposit: null, link: "L" }, es.quoteMessage);
    expect(text).toContain("• Little Moments: $149\n");
    expect(text).toContain("• Little Moments: $224 ($149 + $75 por gemelos)");
    expect(text).toContain("Sin cargo de viaje para tu zona.");
    expect(text).toContain("Nada que pagar hoy: pagas después de tu sesión.");
  });
});

describe("Not born yet: the due-date window and form", () => {
  test("9 months from today, the last day of a shorter month when needed", () => {
    expect(addMonthsToKey("2026-11-10", 9)).toBe("2027-08-10");
    expect(addMonthsToKey("2026-12-15", 9)).toBe("2027-09-15");
    expect(addMonthsToKey("2026-05-31", 9)).toBe("2027-02-28");
    expect(addMonthsToKey("2027-05-31", 9)).toBe("2028-02-29");
    expect(dueWindow("2026-11-10")).toEqual({ from: "2026-11-10", to: "2027-08-10" });
  });

  test("the reservation form needs a bundle, a real due date, contact details and the home address", () => {
    const ok = { bundleId: "lm", dueDate: "2027-01-15", contact: { parentName: "Ana Diaz", email: "ana@example.com", phone: "305 555 1234" }, address: { street: "123 Main St", city: "Miami", zip: "33139" } };
    expect(dueRequestSchema.safeParse(ok).success).toBe(true);
    expect(dueRequestSchema.safeParse({ ...ok, dueDate: "2027-02-30" }).success).toBe(false);
    expect(dueRequestSchema.safeParse({ ...ok, babyCount: 4 }).success).toBe(false);
    expect(dueRequestSchema.safeParse({ ...ok, contact: { ...ok.contact, phone: "123" } }).success).toBe(false);
  });

  test("a booking request takes the schedule link's token only in its exact shape", () => {
    const base = { bundleId: "lm", slot: { date: "2027-01-20", start: "10:00" }, contact: { parentName: "Ana Diaz", email: "ana@example.com", phone: "305 555 1234", babyAge: "Newborn (0–2 weeks)" }, address: { street: "123 Main St", city: "Miami", zip: "33139" } };
    expect(bookingRequestSchema.safeParse({ ...base, dueToken: "a".repeat(43) }).success).toBe(true);
    expect(bookingRequestSchema.safeParse({ ...base, dueToken: "not-a-token" }).success).toBe(false);
  });
});
