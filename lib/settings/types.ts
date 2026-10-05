import type { TinyHumansTheme } from "@/config/themes";
import type { PortfolioPhoto } from "@/config/portfolio";

/** Picture sets use the same names as the themes, but are chosen separately. */
export type PhotoSetId = TinyHumansTheme;

/** Everything the owner can change from /admin. */
export interface SiteSettings {
  themeId: TinyHumansTheme;
  /** Which picture set is on the site. Independent of the theme. */
  photoSetId: PhotoSetId;
  /**
   * Picture sets. A missing "default" set means the built-in photos from
   * config/portfolio.ts; a missing seasonal set means "no photos yet".
   */
  photoSets: Partial<Record<PhotoSetId, PortfolioPhoto[]>>;
  updatedAt: string | null;
}
