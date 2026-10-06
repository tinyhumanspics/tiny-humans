import type { TinyHumansTheme } from "@/config/themes";
import type { ThemeMedia } from "@/config/media";

/** Everything the owner can change from /admin (stored in Vercel Blob). */
export interface SiteSettings {
  /** The theme visitors see. */
  themeId: TinyHumansTheme;
  /**
   * Pictures per theme, by website section (see config/media.ts). Each theme is
   * independent: an empty slot shows the built-in picture, never another theme's.
   */
  media: Partial<Record<TinyHumansTheme, ThemeMedia>>;
  updatedAt: string | null;
}
