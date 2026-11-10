import type { AddonLine } from "@/lib/booking/extra-babies";
import type { TravelQuote } from "@/lib/travel/types";

/** /admin → Quotes: one bundle's price for a family's ZIP code, worked out like the booking form does today. */
export interface QuoteLine {
  bundleId: string;
  name: string;
  /** The bundle price used today (the special offer when one runs), before add-ons and travel. */
  bundleCents: number;
  regularCents: number;
  /** "Thanksgiving offer", or "10% off" when the owner's % off is the saving used. */
  offerLabel: string | null;
  /** Which saving the bundle price uses: the running special offer, the owner's % off, or none (only one counts). */
  saving: "offer" | "percent" | null;
  /** Twins/triplets and extra family members (never reduced by an offer). */
  addons: AddonLine[];
  /** 0 unless the ZIP code's travel status is "fee". */
  travelCents: number;
  totalCents: number;
  /** What booking online would take today (null = deposits off). */
  depositCents: number | null;
  /** Why the booking form wouldn't take this (e.g. no triplets on this bundle), else null. */
  unavailable: string | null;
}

export interface QuoteResult {
  zip: string;
  babies: number;
  family: number;
  /** The owner's % off for this quote (0 = none). Like a discount code: only the bigger saving counts. */
  percent: number;
  /** The home base distances are measured from (null = travel fees not set up). */
  baseZip: string | null;
  travel: TravelQuote;
  today: string;
  lines: QuoteLine[];
  /** Ready-to-send text for a DM or text message, in both languages (the owner can edit it before copying). */
  messages: { en: string; es: string };
}

/** The ZIP code in what the owner pasted: the last 5-digit group ("…Weston, FL 33326-1234" → 33326), else null. */
export function zipFromText(text: string): string | null {
  const all = [...text.matchAll(/(?<![\d-])(\d{5})(?:-\d{4})?(?![\d-])/g)];
  return all.length ? all[all.length - 1][1] : null;
}
