import type { Bundle, ExtraBabyAddon, ExtraPersonAddon } from "@/lib/pricing/types";
import type { PriceQuote } from "@/lib/pricing/engine";
import { FAMILY_INCLUDED_PEOPLE, MAX_FAMILY_MEMBERS, type BabyGender } from "@/config/booking";

export const EXTRA_BABY_KIND = "extra_baby" as const;
/** Each family member over a family bundle's included people (owner, Nov 10: "charge an extra $75 just like the extra baby"). */
export const EXTRA_PERSON_KIND = "extra_person" as const;
export const ADDON_KINDS = [EXTRA_BABY_KIND, EXTRA_PERSON_KIND] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];
export const DEFAULT_EXTRA_BABY: ExtraBabyAddon = { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 };
export const DEFAULT_EXTRA_PERSON: ExtraPersonAddon = { active: true, price: 75, maxExtra: 5 };

export interface BookingBaby {
  name?: string;
  age: string;
  /** Only when the parent picked one (optional). Never sent to Meta or analytics. */
  gender?: BabyGender;
}

/** Studio-side words (owner emails, Outlook event, /admin); customers get them from messages/. */
const OWNER_GENDERS: Record<BabyGender, string> = { boy: "Boy", girl: "Girl" };

export interface AddonLine {
  kind: AddonKind;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  extraMinutes: number;
  extraPhotos: number;
}

export const babyCount = (babies?: BookingBaby[]) => Math.max(1, babies?.length ?? 1);

export function extraBabyLine(bundle: Bundle, count: number): AddonLine | null {
  const addon = bundle.extraBaby;
  const quantity = Math.max(0, Math.trunc(count) - 1);
  if (!quantity) return null;
  if (!addon?.active || count > addon.maxBabies) return null;
  const unitPriceCents = Math.round(addon.price * 100);
  return {
    kind: EXTRA_BABY_KIND,
    name: quantity === 1 ? "Extra baby" : "Extra babies",
    quantity,
    unitPriceCents,
    totalCents: unitPriceCents * quantity,
    extraMinutes: addon.extraMinutes * quantity,
    extraPhotos: addon.extraPhotos * quantity,
  };
}

export const sessionMinutes = (bundle: Bundle, count: number) => bundle.durationMinutes + (extraBabyLine(bundle, count)?.extraMinutes ?? 0);

/** People over a family bundle's included ones (babies counted): 1 baby + 6 family = 2 extra. */
export const extraPeopleCount = (babyCount: number, familyCount: number) => Math.max(0, Math.trunc(babyCount) + Math.trunc(familyCount) - FAMILY_INCLUDED_PEOPLE);

/** The extra-person line, or null when nobody is over (or the bundle doesn't offer it / they're over its maximum). */
export function extraPersonLine(bundle: Bundle, babyCount: number, familyCount: number): AddonLine | null {
  const quantity = extraPeopleCount(babyCount, familyCount);
  const addon = bundle.extraPerson;
  if (!quantity || !addon?.active || quantity > addon.maxExtra) return null;
  const unitPriceCents = Math.round(addon.price * 100);
  return { kind: EXTRA_PERSON_KIND, name: quantity === 1 ? "Extra family member" : "Extra family members", quantity, unitPriceCents, totalCents: unitPriceCents * quantity, extraMinutes: 0, extraPhotos: 0 };
}

/** The most family members this bundle takes with this many babies: the included ones + its extra-person maximum. */
export function familyLimit(bundle: Bundle, babyCount: number): number {
  const included = Math.max(0, FAMILY_INCLUDED_PEOPLE - babyCount);
  return Math.min(MAX_FAMILY_MEMBERS, included + (bundle.extraPerson?.active ? bundle.extraPerson.maxExtra : 0));
}

/** Adds the extra-baby and extra-person lines after bundle pricing, so offers/codes can only reduce the bundle. */
export function withAddons(quote: PriceQuote, bundle: Bundle, babyCount: number, familyCount = 0): PriceQuote {
  const addons = [extraBabyLine(bundle, babyCount), extraPersonLine(bundle, babyCount, familyCount)].filter((l): l is AddonLine => l !== null);
  const addonsCents = addons.reduce((sum, l) => sum + l.totalCents, 0);
  return { ...quote, addons, addonsCents, totalCents: quote.finalCents + addonsCents };
}

/** "5–8" + 5 becomes "10–13"; non-numeric owner-entered labels remain unchanged. */
export function addPhotos(label: string | null | undefined, extra: number): string {
  const text = label?.trim() ?? "";
  if (!text || extra <= 0) return text;
  return /\d/.test(text) ? text.replace(/\d+/g, (n) => String(Number(n) + extra)) : text;
}

export function babiesLabel(babies: BookingBaby[]): string {
  return babies
    .map((baby, i) => `${baby.name?.trim() || `Baby ${i + 1}`} (${baby.gender ? `${OWNER_GENDERS[baby.gender]}, ` : ""}${baby.age})`)
    .join(", ");
}

export function babyNames(babies: BookingBaby[], conjunction = "and"): string | null {
  const names = babies.map((b) => b.name?.trim()).filter((n): n is string => Boolean(n));
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names.at(-1)}`;
}
