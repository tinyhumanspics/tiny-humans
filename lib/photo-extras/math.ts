import type { Deliveries, ExtraLine, ExtrasBought, ExtrasChoice, ExtrasLeft, ExtrasSettings } from "./types";

/**
 * The extras' price math, the same on the page (live total) and the server (which never trusts the page's numbers).
 * Extra edited photos are capped per booking across all orders; the full gallery replaces them and costs less what
 * they already paid for extras; the unedited files go with either.
 */
type Prices = Pick<ExtrasSettings, "extraPhotoCents" | "maxExtras" | "fullGalleryCents" | "rawFilesCents">;

export const NO_PURCHASES: ExtrasBought = { extras: 0, extrasPaidCents: 0, full: false, raw: false };

/** Totals of the paid orders' lines. */
export function boughtFrom(orders: { lines: ExtraLine[] }[]): ExtrasBought {
  return orders.flatMap((o) => o.lines).reduce<ExtrasBought>(
    (b, l) =>
      l.kind === "extra_photos"
        ? { ...b, extras: b.extras + l.quantity, extrasPaidCents: b.extrasPaidCents + l.totalCents }
        : l.kind === "full_gallery"
          ? { ...b, full: true }
          : { ...b, raw: true },
    NO_PURCHASES,
  );
}

export function whatsLeft(p: Prices, bought: ExtrasBought): ExtrasLeft {
  const extrasLeft = bought.full ? 0 : Math.max(0, p.maxExtras - bought.extras);
  const canFull = !bought.full;
  const canRaw = !bought.raw;
  return { extrasLeft, canFull, canRaw, fullCreditCents: Math.min(bought.extrasPaidCents, p.fullGalleryCents), nothingLeft: !canFull && !canRaw };
}

type Promises = Pick<ExtrasSettings, "extrasDeliveryHours" | "fullDeliveryDays" | "rawDeliveryHours">;

/** When each option arrives if bought now: extra photos come with the finished gallery until it's delivered. */
export const deliveries = (s: Promises, galleryDelivered: boolean): Deliveries => ({
  extras: { amount: s.extrasDeliveryHours, unit: "hours", ...(galleryDelivered ? {} : { withGallery: true }) },
  full: { amount: s.fullDeliveryDays, unit: "days" },
  raw: { amount: s.rawDeliveryHours, unit: "hours" },
});

export type PricedOrder = { lines: ExtraLine[]; creditCents: number; totalCents: number };
export type PriceError = "nothing" | "too_many" | "already";

/** The order for a choice, or why it can't be bought. Picking the full gallery drops any extra photos. */
export function priceOrder(s: Prices & Promises, bought: ExtrasBought, choice: ExtrasChoice, galleryDelivered = false): PricedOrder | { error: PriceError } {
  const left = whatsLeft(s, bought);
  const extras = choice.full ? 0 : choice.extras;
  if (!Number.isInteger(extras) || extras < 0) return { error: "nothing" };
  if (extras > left.extrasLeft) return { error: "too_many" };
  if ((choice.full && !left.canFull) || (choice.raw && !left.canRaw)) return { error: "already" };
  const when = deliveries(s, galleryDelivered);
  const line = (kind: ExtraLine["kind"], quantity: number, unitCents: number, delivery: ExtraLine["delivery"]): ExtraLine => ({ kind, quantity, unitCents, totalCents: quantity * unitCents, delivery });
  const lines = [
    ...(extras > 0 ? [line("extra_photos", extras, s.extraPhotoCents, when.extras)] : []),
    ...(choice.full ? [line("full_gallery", 1, s.fullGalleryCents, when.full)] : []),
    ...(choice.raw ? [line("unedited_files", 1, s.rawFilesCents, when.raw)] : []),
  ];
  if (!lines.length) return { error: "nothing" };
  const creditCents = choice.full ? left.fullCreditCents : 0;
  const totalCents = lines.reduce((sum, l) => sum + l.totalCents, 0) - creditCents;
  return totalCents > 0 ? { lines, creditCents, totalCents } : { error: "nothing" };
}
