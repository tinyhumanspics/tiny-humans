import type { SeasonalOfferDefinition } from "@/config/seasonal";
import { SEASONAL_OFFER_DEFINITIONS } from "@/config/seasonal";
import type { TinyHumansTheme } from "@/config/themes";
import type { SeasonalOfferSettings } from "@/lib/settings/types";
import type { AppLocale } from "@/i18n/config";

export interface ActiveSeasonalOffer extends SeasonalOfferDefinition, SeasonalOfferSettings {}

/** Active through the cutoff date; the date is supplied in Miami time by CatalogProvider. */
export function activeSeasonalOffers(
  offers: Record<SeasonalOfferDefinition["id"], SeasonalOfferSettings>,
  themeId: TinyHumansTheme,
  today: string,
  locale: AppLocale = "en",
): ActiveSeasonalOffer[] {
  return SEASONAL_OFFER_DEFINITIONS
    .filter((definition) => definition.themeId === themeId)
    .map((definition) => ({ ...definition, ...offers[definition.id] }))
    .filter((offer) => offer.enabled && today <= offer.cutoff)
    .flatMap((offer) => {
      if (locale === "en") return [offer];
      return offer.spanish ? [{ ...offer, title: offer.spanish.title, description: offer.spanish.description }] : [];
    });
}
