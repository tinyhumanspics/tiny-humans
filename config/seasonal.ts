import type { TinyHumansTheme } from "./themes";

export const SEASONAL_OFFER_IDS = ["thanksgiving", "firstChristmas"] as const;
export type SeasonalOfferId = (typeof SEASONAL_OFFER_IDS)[number];

export interface SeasonalOfferDefinition {
  id: SeasonalOfferId;
  adminLabel: string;
  themeId: TinyHumansTheme;
}

/** Structure is code; the owner-editable copy, dates and on/off state live in site settings. */
export const SEASONAL_OFFER_DEFINITIONS: readonly SeasonalOfferDefinition[] = [
  { id: "thanksgiving", adminLabel: "Baby’s First Thanksgiving", themeId: "thanksgiving" },
  { id: "firstChristmas", adminLabel: "Baby’s First Christmas", themeId: "christmas" },
];
