import type { TinyHumansTheme } from "@/config/themes";
import type { ThemeMedia } from "@/config/media";
import type { SeasonalOfferTheme } from "@/config/seasonal";

export interface SeasonalOfferSettings {
  /** Hidden until the owner explicitly switches this offer on. */
  enabled: boolean;
  title: string;
  description: string;
  /** Optional matched copy for the Spanish landing page; null keeps this offer hidden there. */
  spanish: { title: string; description: string } | null;
  /** Last session date, inclusive, in YYYY-MM-DD format. */
  cutoff: string;
}

/** One seasonal offer box (/admin → Seasonal Landing): the ad page and the home page show it while it's live. */
export interface SeasonalOffer extends SeasonalOfferSettings {
  /** "thanksgiving" / "firstChristmas" for the built-in two, "offer-…" for the owner's own. */
  id: string;
  /** Its name in /admin, e.g. "Valentine's Day". */
  name: string;
  /** Shown only while this theme is live; "any" = with every theme. */
  themeId: SeasonalOfferTheme;
}

/** Everything the owner can change from /admin (stored in Vercel Blob). */
export interface SiteSettings {
  /** The theme visitors see. */
  themeId: TinyHumansTheme;
  /** Owner-controlled publication switch. Readiness checks can still keep Spanish safely hidden. */
  spanishPublished: boolean;
  /**
   * Pictures per theme, by website section (see config/media.ts). Each theme is
   * independent: an empty slot shows the built-in picture, never another theme's.
   */
  media: Partial<Record<TinyHumansTheme, ThemeMedia>>;
  /** Seasonal offer boxes (built-in two first, then the owner's own), edited in /admin → Seasonal Landing. */
  seasonalOffers: SeasonalOffer[];
  updatedAt: string | null;
}

export interface SpanishPublicationStatus {
  /** The switch saved by the owner in /admin. */
  enabled: boolean;
  /** What visitors can actually reach after all readiness checks. */
  published: boolean;
  /** Missing live content that prevents publication. */
  issues: string[];
}
