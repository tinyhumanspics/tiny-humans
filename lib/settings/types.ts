import type { TinyHumansTheme } from "@/config/themes";
import type { ThemeMedia } from "@/config/media";

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
  /**
   * The "Book a memory like this one" boxes in the home page's "Little moments" (owner, Nov 11): false hides every box
   * in every theme; each section keeps its own on/off and wording for when this is switched back on. Old saves = true.
   */
  portfolioBoxes: boolean;
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
