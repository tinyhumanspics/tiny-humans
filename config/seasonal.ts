import type { TinyHumansTheme } from "./themes";

export const SEASONAL_OFFER_IDS = ["thanksgiving", "firstChristmas", "valentines"] as const;
export type SeasonalOfferId = (typeof SEASONAL_OFFER_IDS)[number];

export interface SeasonalOfferDefinition {
  id: SeasonalOfferId;
  adminLabel: string;
  themeId: TinyHumansTheme;
}

/** Theme an offer shows with: one theme, or "any" (every theme, while it's switched on and before its last day). */
export type SeasonalOfferTheme = TinyHumansTheme | "any";

/** Owner-added offers (Valentine's Day, Mother's Day, …): at most this many in total, built-ins included. */
export const MAX_SEASONAL_OFFERS = 12;

/**
 * The built-in offers (always listed; the owner can switch them off but not delete them). Owner-added ones live
 * only in site settings. The copy, dates, theme and on/off state of every offer live in site settings.
 */
export const SEASONAL_OFFER_DEFINITIONS: readonly SeasonalOfferDefinition[] = [
  { id: "thanksgiving", adminLabel: "Baby’s First Thanksgiving", themeId: "thanksgiving" },
  { id: "firstChristmas", adminLabel: "Baby’s First Christmas", themeId: "christmas" },
  // owner, Nov 10: "Show love to your tiny human", all February with the Valentine's theme
  { id: "valentines", adminLabel: "Valentine's Day", themeId: "valentines" },
];
