import type { Bundle, ExtraBabyAddon } from "@/config/bundles";
import type { PriceQuote } from "@/lib/pricing/engine";

export const EXTRA_BABY_KIND = "extra_baby" as const;
export const DEFAULT_EXTRA_BABY: ExtraBabyAddon = { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 };

export interface BookingBaby {
  name?: string;
  age: string;
}

export interface AddonLine {
  kind: typeof EXTRA_BABY_KIND;
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

/** Adds the extra-baby line after bundle pricing, so offers/codes can only reduce the bundle. */
export function withExtraBabies(quote: PriceQuote, bundle: Bundle, count: number): PriceQuote {
  const line = extraBabyLine(bundle, count);
  const addons = line ? [line] : [];
  const addonsCents = line?.totalCents ?? 0;
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
    .map((baby, i) => `${baby.name?.trim() || `Baby ${i + 1}`} (${baby.age})`)
    .join(", ");
}

export function babyNames(babies: BookingBaby[], conjunction = "and"): string | null {
  const names = babies.map((b) => b.name?.trim()).filter((n): n is string => Boolean(n));
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names.at(-1)}`;
}
