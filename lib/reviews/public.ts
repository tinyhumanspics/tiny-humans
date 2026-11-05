import type { AppLocale } from "@/i18n/config";

/** What the website shows of a review the owner picked in /admin (the family said OK): no booking or contact details. */
export interface PublicReview {
  rating: number;
  body: string;
  /** The name the family chose to show, e.g. "Ana M." */
  displayName: string;
  /** The language the family booked in (the review's most likely language, for screen readers). */
  lang: AppLocale;
}

/** How many picked reviews the home page and the ad landing page show (the newest reviews first). */
export const PUBLIC_REVIEWS_MAX = 6;

/** Long reviews show about this many characters, then "Read more". */
export const REVIEW_PREVIEW_CHARS = 220;

/**
 * The start of a long review, cut after a whole word, with "…". Null when the review is short enough to show whole
 * (it never hides just a few words behind "Read more").
 */
export function reviewPreview(body: string, max = REVIEW_PREVIEW_CHARS): string | null {
  const text = body.trim();
  if (text.length <= max + 40) return null;
  const cut = text.slice(0, max);
  const lastSpace = cut.search(/\s\S*$/);
  const words = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${words.replace(/[\s.,;:!?¡¿—–-]+$/u, "")}…`;
}
