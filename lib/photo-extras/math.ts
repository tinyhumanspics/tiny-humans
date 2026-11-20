import type { Delivery, ExtraLine, ExtrasBought, ExtrasChoice, ExtrasLeft, ExtrasSettings } from "./types";

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

export type PricedOrder = { lines: ExtraLine[]; creditCents: number; totalCents: number };
export type PriceError = "nothing" | "too_many" | "already";

/** The order for a choice, or why it can't be bought. Picking the full gallery drops any extra photos. */
export function priceOrder(s: Prices & Pick<ExtrasSettings, "extrasDeliveryHours" | "fullDeliveryDays" | "rawDeliveryHours">, bought: ExtrasBought, choice: ExtrasChoice): PricedOrder | { error: PriceError } {
  const left = whatsLeft(s, bought);
  const extras = choice.full ? 0 : choice.extras;
  if (!Number.isInteger(extras) || extras < 0) return { error: "nothing" };
  if (extras > left.extrasLeft) return { error: "too_many" };
  if ((choice.full && !left.canFull) || (choice.raw && !left.canRaw)) return { error: "already" };
  const line = (kind: ExtraLine["kind"], quantity: number, unitCents: number, delivery: Delivery): ExtraLine => ({ kind, quantity, unitCents, totalCents: quantity * unitCents, delivery });
  const lines = [
    ...(extras > 0 ? [line("extra_photos", extras, s.extraPhotoCents, { amount: s.extrasDeliveryHours, unit: "hours" })] : []),
    ...(choice.full ? [line("full_gallery", 1, s.fullGalleryCents, { amount: s.fullDeliveryDays, unit: "days" })] : []),
    ...(choice.raw ? [line("unedited_files", 1, s.rawFilesCents, { amount: s.rawDeliveryHours, unit: "hours" })] : []),
  ];
  if (!lines.length) return { error: "nothing" };
  const creditCents = choice.full ? left.fullCreditCents : 0;
  const totalCents = lines.reduce((sum, l) => sum + l.totalCents, 0) - creditCents;
  return totalCents > 0 ? { lines, creditCents, totalCents } : { error: "nothing" };
}
