import type { Bundle } from "@/config/bundles";
import { babyAgeOptions } from "@/config/booking";
import type { PriceQuote } from "@/lib/pricing/engine";
import { formatMoney } from "@/lib/pricing/engine";
import type en from "@/messages/en.json";
import type { BookingBaby } from "./extra-babies";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Baby names and stored age values as the booking page shows them in the selected language. */
export function bookingBabiesLabel(babies: BookingBaby[], messages: typeof en.bookingFlow.details): string {
  return babies
    .map((baby, index) => {
      const ageIndex = babyAgeOptions.indexOf(baby.age as (typeof babyAgeOptions)[number]);
      const age = ageIndex >= 0 ? messages.baby.ageOptions[ageIndex] : baby.age;
      return `${baby.name?.trim() || fill(messages.baby.number, { number: String(index + 1) })} (${age})`;
    })
    .join(", ");
}

/** Bundle savings and full-price baby add-ons as the booking page shows them in the selected language. */
export function bookingPricingRows(p: PriceQuote, bundle: Pick<Bundle, "offer">, messages: typeof en.bookingFlow.review): [string, string][] {
  const labels = messages.labels;
  const rows: [string, string][] = [];
  if (p.pricingType === "offer") {
    rows.push(
      [labels.regularPrice, formatMoney(p.regularCents)],
      [bundle.offer?.label?.trim() || p.offerLabel || labels.specialOffer, formatMoney(p.offerCents ?? p.finalCents)],
    );
  }
  if (p.pricingType === "discount") {
    rows.push(
      [labels.regularPrice, formatMoney(p.regularCents)],
      [labels.discountCode, p.discountCode ?? ""],
      [labels.discount, `-${formatMoney(p.discountCents)}`],
    );
  }
  rows.push([labels.bundleTotal, formatMoney(p.finalCents)]);
  p.addons.forEach((addon) => rows.push([addon.quantity === 1 ? labels.extraBaby : labels.extraBabies, `${addon.quantity} × ${formatMoney(addon.unitPriceCents)} = ${formatMoney(addon.totalCents)}`]));
  if (p.addonsCents > 0) rows.push([labels.sessionTotalBeforeTravel, formatMoney(p.totalCents)]);
  return rows;
}
