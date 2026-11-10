import type { Bundle } from "@/lib/pricing/types";
import type { AddonLine } from "@/lib/booking/extra-babies";

/**
 * Central pricing logic, shared by the public cards, the booking review and the
 * server (which always recomputes at booking time). Money is handled in cents.
 * Only ONE saving ever applies: regular price, special offer, OR a discount code,
 * whichever valid option gives the lowest total.
 */
export type PricingType = "regular" | "offer" | "discount";

export interface PriceQuote {
  bundleId: string;
  bundleName: string;
  regularCents: number;
  /** Set when the special offer is the price used. */
  offerCents: number | null;
  offerLabel: string | null;
  offerEndsOn: string | null;
  /** Set when a discount code is the price used. */
  discountCode: string | null;
  discountCents: number;
  /** Discounted bundle subtotal. Add-ons and travel are never included here. */
  finalCents: number;
  /** Add-ons are separate so offers/codes can never reduce them. */
  addons: AddonLine[];
  addonsCents: number;
  /** Discounted bundle + add-ons, before travel. */
  totalCents: number;
  pricingType: PricingType;
  /** Friendly note, e.g. when a code wasn't needed because the offer is better. */
  note?: string | null;
}

export interface CodeTerms {
  code: string;
  type: "percent" | "fixed";
  /** percent: 1-100; fixed: cents */
  value: number;
}

export const toCents = (dollars: number) => Math.round(dollars * 100);

export function formatMoney(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d.toString() : d.toFixed(2)}`;
}

/** Percent offers: the most a "% off" offer can take off (an offer must stay above $0). */
export const MAX_OFFER_PERCENT = 90;

/** The price after a whole-percent offer, in exact cents (rounded like a percentage discount code). */
export const percentOffCents = (regularCents: number, percent: number) => Math.round((regularCents * (100 - percent)) / 100);

/**
 * The whole percent an offer takes off, when its price is exactly that percent off the regular price, else null.
 * "% off" offers are saved as that exact price, so no separate column is needed (owner, Nov 10).
 */
export function offerPercent(regularCents: number, offerCents: number): number | null {
  if (!(offerCents > 0) || offerCents >= regularCents) return null;
  const percent = Math.round((1 - offerCents / regularCents) * 100);
  return percent >= 1 && percent <= MAX_OFFER_PERCENT && percentOffCents(regularCents, percent) === offerCents ? percent : null;
}

/** The offer that applies today, or null (disabled, expired, or not cheaper). */
export function activeOffer(b: Bundle, today: string) {
  const o = b.offer;
  if (!o || !o.enabled || !(o.price > 0) || toCents(o.price) >= toCents(b.price)) return null;
  if (o.endsOn && today > o.endsOn) return null;
  const cents = toCents(o.price);
  return { cents, label: o.label?.trim() || "Special offer", endsOn: o.endsOn ?? null, percent: offerPercent(toCents(b.price), cents) };
}

export function codeDiscountCents(regularCents: number, c: CodeTerms): number {
  const d = c.type === "percent" ? Math.round((regularCents * Math.min(100, Math.max(0, c.value))) / 100) : Math.max(0, c.value);
  return Math.min(regularCents, d);
}

/** Price for a bundle today, optionally with a (server-validated) code. Never stacks. */
export function computeQuote(b: Bundle, today: string, code?: CodeTerms | null): PriceQuote {
  const regularCents = toCents(b.price);
  const offer = activeOffer(b, today);
  const base: PriceQuote = { bundleId: b.id, bundleName: b.name, regularCents, offerCents: null, offerLabel: null, offerEndsOn: null, discountCode: null, discountCents: 0, finalCents: regularCents, addons: [], addonsCents: 0, totalCents: regularCents, pricingType: "regular", note: null };
  const offerQuote: PriceQuote | null = offer ? { ...base, offerCents: offer.cents, offerLabel: offer.label, offerEndsOn: offer.endsOn, discountCents: regularCents - offer.cents, finalCents: offer.cents, totalCents: offer.cents, pricingType: "offer" } : null;
  if (!code) return offerQuote ?? base;
  const disc = codeDiscountCents(regularCents, code);
  const codeQuote: PriceQuote = { ...base, discountCode: code.code, discountCents: disc, finalCents: regularCents - disc, totalCents: regularCents - disc, pricingType: "discount" };
  if (offerQuote && offerQuote.finalCents <= codeQuote.finalCents) {
    return { ...offerQuote, note: `Your ${offer!.label} already gives you the best price, so the code wasn't added. Only one saving can be used per booking.` };
  }
  return offerQuote ? { ...codeQuote, note: `Your code gives you a better price than the ${offer!.label}, so we've used the code instead. Only one saving can be used per booking.` } : codeQuote;
}

/** "Up to 45 minutes" / "Up to 90 minutes" / "Up to 2 hours" / "Up to 2.5 hours" (same wording as the original bundles). */
export function durationLabel(minutes: number): string {
  if (minutes < 120 || minutes % 30 !== 0) return `Up to ${minutes} minutes`;
  const h = minutes / 60;
  return `Up to ${h} ${h === 1 ? "hour" : "hours"}`;
}
