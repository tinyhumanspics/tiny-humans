import { site } from "@/config/site";
import type { PortfolioPhoto } from "@/config/portfolio";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { PublicReview } from "@/lib/reviews/public";
import en from "@/messages/en.json";
import styles from "./Landing.module.css";

export /** Admin photo names that are file names ("IMG 6087", "UPDATED 10") never become alt text, nor a "(placeholder)" tag. */
const altOf = (photo: PortfolioPhoto, fallback: string) => {
  const alt = photo.alt.replace(/\s*\((placeholder|foto provisional)\)\s*$/i, "").trim();
  return !alt || /^(img|dsc|updated|photo)[\s_-]*\d+$/i.test(alt) ? fallback : alt;
};

/** One real review under "Check dates" (picked in /admin; the family said OK), shortened, with its language when it differs. */
export function ProofLine({ review, locale, langs = en.landing.proofLang }: { review: PublicReview | undefined; locale: AppLocale; langs?: typeof en.landing.proofLang }) {
  if (!review) return null;
  const text = review.body.length > 170 ? `${review.body.slice(0, 167).replace(/\s+\S*$/, "")}…` : review.body;
  return (
    <figure className={styles.proof}>
      <blockquote lang={review.lang} className="chalk-soft">
        “{text}”
      </blockquote>
      <figcaption className="chalk-soft">
        — {review.displayName}
        {review.lang !== locale ? ` (${langs[review.lang]})` : ""}
      </figcaption>
    </figure>
  );
}

/** "Questions first? Text us: (786) 222-7194" (an sms: link: Meta's Contact event, brief 03). */
export function TextUs({ text }: { text: string }) {
  return (
    <p className={cn(styles.textUs, "chalk-soft")}>
      {text}{" "}
      <a href={`sms:${site.contact.sms}`} className={styles.textLink}>
        {site.contact.phone}
      </a>
    </p>
  );
}
