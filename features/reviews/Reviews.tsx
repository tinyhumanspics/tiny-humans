"use client";

import { useId, useState } from "react";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import { reviewPreview, type PublicReview } from "@/lib/reviews/public";
import { fill } from "@/lib/email/messages";
import { cn } from "@/lib/cn";
import en from "@/messages/en.json";
import styles from "./Reviews.module.css";

type Messages = typeof en.reviewsSection;

/**
 * "What families say": the reviews the owner picked in /admin → Leads ("Use on the website"; only reviews the family
 * said OK to show). Renders nothing while there are none. `placement` sets the spacing for the home page (after the
 * photos) or the ad landing page (between the photographers and the questions).
 */
export default function Reviews({ reviews, messages = en.reviewsSection, placement }: { reviews: PublicReview[]; messages?: Messages; placement: "home" | "landing" }) {
  if (!reviews.length) return null;
  const id = `${placement}-reviews`;
  return (
    <section className={cn("container", styles.section)} data-placement={placement} aria-labelledby={id}>
      <SectionHeading id={id} title={messages.title} subtitle={messages.subtitle} slot="portfolio" align="center" />
      <ul className={styles.list} data-count={reviews.length}>
        {reviews.map((review, i) => (
          <Reveal as="li" key={`${i}-${review.displayName}`} className={styles.item} delay={(i % 3) * 90}>
            <ReviewCard review={review} index={i} messages={messages} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({ review, index, messages }: { review: PublicReview; index: number; messages: Messages }) {
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
        <figcaption className={cn(styles.name, "chalk")}>{fill(messages.signature, { name: review.displayName })}</figcaption>
      </figure>
    </ChalkBox>
  );
}
