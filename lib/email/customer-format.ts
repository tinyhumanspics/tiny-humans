import { BACKDROPS } from "@/config/backdrops";
import type { BookingBaby } from "@/lib/booking/extra-babies";
import type { PriceQuote } from "@/lib/pricing/engine";
import { formatMoney } from "@/lib/pricing/engine";
import { site } from "@/config/site";
import { emailMessages, emailPolicy, fill, type EmailLocale } from "./messages";

/** Customer-facing price rows. Studio/calendar rows stay English in `lib/booking/templates.ts`. */
export function customerPricingRows(p: PriceQuote, locale: EmailLocale): [string, string][] {
  const m = emailMessages(locale).common;
  const rows: [string, string][] = [];
  if (p.pricingType === "offer") rows.push([m.regularPrice, formatMoney(p.regularCents)], [p.offerLabel || m.specialOffer, formatMoney(p.offerCents ?? p.finalCents)]);
  if (p.pricingType === "discount") rows.push([m.regularPrice, formatMoney(p.regularCents)], [m.discountCode, p.discountCode ?? ""], [m.discount, `-${formatMoney(p.discountCents)}`]);
  rows.push([m.bundleTotal, formatMoney(p.finalCents)]);
  p.addons.forEach((a) => {
    // Keep the booked English snapshot name exactly as it was; translate the known customer-facing add-on in Spanish.
    const name = locale === "en" ? a.name : a.quantity === 1 ? m.extraBaby : m.extraBabies;
    rows.push([name, `${a.quantity} × ${formatMoney(a.unitPriceCents)} = ${formatMoney(a.totalCents)}`]);
  });
  if (p.addonsCents > 0) rows.push([m.sessionTotalBeforeTravel, formatMoney(p.totalCents)]);
  return rows;
}

export function customerBabiesLabel(babies: BookingBaby[], locale: EmailLocale): string {
  const m = emailMessages(locale).common;
  const ages = m.ages as Record<string, string>;
  return babies.map((baby, index) => `${baby.name?.trim() || fill(m.babyNumber, { number: String(index + 1) })} (${ages[baby.age] ?? baby.age})`).join(", ");
}

export function customerBabyNames(babies: BookingBaby[], locale: EmailLocale): string | null {
  const names = babies.map((baby) => baby.name?.trim()).filter((name): name is string => Boolean(name));
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${emailMessages(locale).common.and} ${names.at(-1)}`;
}

export function customerBackdropNames(ids: readonly string[], locale: EmailLocale): string {
  const m = emailMessages(locale).backdrops;
  const names = BACKDROPS.filter((backdrop) => ids.includes(backdrop.id)).map((backdrop) => (m.names as Record<string, string>)[backdrop.id] ?? backdrop.id);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} ${emailMessages(locale).common.and} ${names.at(-1)}`;
}

/** Email-only policy copy. Public manage pages keep their own localized UI copy. */
export function emailChangePolicyText(hours: number, locale: EmailLocale): string {
  const m = emailPolicy(locale);
  const notice = fill(hours === 1 ? m.hour : m.hours, { n: String(hours) });
  return fill(m.online, { notice, phone: site.contact.phone });
}
