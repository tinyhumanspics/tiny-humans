import type { TinyHumansTheme } from "@/config/themes";
import type { SeasonalOffer } from "@/lib/settings/types";
import type { AppLocale } from "@/i18n/config";

export type ActiveSeasonalOffer = SeasonalOffer;

/**
 * The offer boxes to show now (ad page + home page): switched on, on or before their last day (Miami date, supplied by
 * CatalogProvider), and made for the live theme (or "any" theme). Spanish pages show an offer only with its Spanish copy.
 */
export function activeSeasonalOffers(offers: SeasonalOffer[], themeId: TinyHumansTheme, today: string, locale: AppLocale = "en"): ActiveSeasonalOffer[] {
  return offers
    .filter((offer) => offer.enabled && today <= offer.cutoff && (offer.themeId === "any" || offer.themeId === themeId))
    .flatMap((offer) => {
      if (locale === "en") return [offer];
      return offer.spanish ? [{ ...offer, title: offer.spanish.title, description: offer.spanish.description }] : [];
    });
}
