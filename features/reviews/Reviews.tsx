"use client";

import { useId, useState } from "react";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import { reviewPreview, type PublicReview } from "@/lib/reviews/public";
import { fill } from "@/lib/email/messages";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import styles from "./Reviews.module.css";

type Messages = typeof en.reviewsSection;
type Langs = typeof en.landing.proofLang;

/**
 * "What families say": the reviews the owner picked in /admin → Leads ("Use on the website"; only reviews the family
 * said OK to show), between the photographers and the questions on the ad page and the home page. Renders nothing while
 * there are none. A review in the other language is shown as written, labelled ("en inglés", brief 05).
 */
export default function Reviews({ reviews, messages = en.reviewsSection, locale = "en", langs = en.landing.proofLang }: { reviews: PublicReview[]; messages?: Messages; locale?: AppLocale; langs?: Langs }) {
  if (!reviews.length) return null;
  const id = "reviews-title";
  return (
    <section className={cn("container", styles.section)} aria-labelledby={id}>
      <SectionHeading id={id} title={messages.title} subtitle={messages.subtitle} slot="portfolio" align="center" />
      <ul className={styles.list} data-count={reviews.length}>
        {reviews.map((review, i) => (
          <Reveal as="li" key={`${i}-${review.displayName}`} className={styles.item} delay={(i % 3) * 90}>
            <ReviewCard review={review} index={i} messages={messages} lang={review.lang !== locale ? langs[review.lang] : null} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({ review, index, messages, lang }: { review: PublicReview; index: number; messages: Messages; lang: string | null }) {
  const [open, setOpen] = useState(false);
  const textId = useId();
  const preview = reviewPreview(review.body);
  return (
    <ChalkBox className={styles.card} seed={810 + index * 7} wobble={2.6} strokeWidth={2.4}>
      <span className={cn(styles.mark, "chalk")} aria-hidden="true">“</span>
      <figure className={styles.figure}>
        {/* one grain mask for the five stars */}
        <span className={cn(styles.stars, "chalk-grain")} role="img" aria-label={fill(messages.rating, { rating: String(review.rating) })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <ChalkDoodle
              key={n}
              name="star"
              size={24}
              grain={false}
              strokeWidth={2.6}
              color={n <= review.rating ? "var(--sun-yellow)" : "var(--chalk-dim)"}
              fill={n <= review.rating ? "var(--sun-yellow)" : "none"}
            />
          ))}
        </span>
        <blockquote id={textId} className={cn(styles.quote, "chalk-soft")} lang={review.lang}>
          <p>{preview && !open ? preview : review.body}</p>
        </blockquote>
        {preview && (
          // the chalk texture goes on the words only: on the button it would also cut off the keyboard focus ring
          <button type="button" className={styles.more} aria-expanded={open} aria-controls={textId} onClick={() => setOpen((o) => !o)}>
            <span className="chalk-soft">{open ? messages.less : messages.more}</span>
          </button>
        )}
        <figcaption className={cn(styles.name, "chalk")}>
          {fill(messages.signature, { name: review.displayName })}
          {lang ? ` (${lang})` : ""}
        </figcaption>
      </figure>
    </ChalkBox>
  );
}
