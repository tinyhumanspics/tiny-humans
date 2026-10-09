import type { TinyHumansTheme } from "@/config/themes";
import type { ThemeMedia } from "@/config/media";
import type { SeasonalOfferId } from "@/config/seasonal";

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

/** Everything the owner can change from /admin (stored in Vercel Blob). */
export interface SiteSettings {
  /** The theme visitors see. */
  themeId: TinyHumansTheme;
  /**
   * Pictures per theme, by website section (see config/media.ts). Each theme is
   * independent: an empty slot shows the built-in picture, never another theme's.
   */
  media: Partial<Record<TinyHumansTheme, ThemeMedia>>;
  /** Seasonal landing copy and real end dates, edited in /admin. */
  seasonalOffers: Record<SeasonalOfferId, SeasonalOfferSettings>;
  updatedAt: string | null;
}
