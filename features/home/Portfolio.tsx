"use client";

import { useRef, useState } from "react";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import PinnedPhoto from "@/components/ui/PinnedPhoto/PinnedPhoto";
import PortfolioLightbox from "@/features/home/PortfolioLightbox";
import Reveal from "@/components/layout/Reveal/Reveal";
import { fill } from "@/lib/email/messages";
import { altOf } from "@/config/media";
import type { AppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import styles from "./Portfolio.module.css";

const tapes = ["yellow", undefined, "blue", undefined, "white", "yellow", undefined, "blue", undefined] as const;

/**
 * The portfolio page (owner, Nov 16: its own page, only the babies' photos): the live theme's "Little moments" photos
 * (/admin → Photos → Portfolio page). A parent taps a picture to see it whole and can use it as the inspiration for
 * their session (the viewer's button opens the bundles with it picked). A photo wall (owner, Nov 16: design B): pinned
 * prints, each at its own shape, in columns (2 on phones, 3 on computers).
 */
export default function Portfolio({ messages = en.home.portfolio, locale = "en" }: { messages?: typeof en.home.portfolio; locale?: AppLocale }) {
  const id = "portfolio";
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const { photos } = useSiteSettings();
  const portfolio = photos.map((photo) => ({ ...photo, alt: altOf(photo, messages.photoAlt) }));

  const close = () => {
    const i = openIndex;
    setOpenIndex(null);
    if (i !== null) triggers.current[i]?.focus({ preventScroll: true });
  };

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.title} subtitle={messages.subtitle} slot="portfolio" level={1} />
        {portfolio.length > 0 && <p className={cn(styles.pickHint, "chalk-soft")}>{messages.pickHint}</p>}
        <ul className={styles.wall}>
          {portfolio.map((photo, i) => (
            <Reveal as="li" key={photo.id} className={styles.wallItem} delay={(i % 3) * 90}>
              <button
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                type="button"
                className={styles.trigger}
                onClick={() => setOpenIndex(i)}
                aria-label={fill(messages.openPhoto, { current: String(i + 1), total: String(portfolio.length), alt: photo.alt })}
              >
                <PinnedPhoto photo={photo} seed={100 + i} tape={tapes[i % tapes.length]} sizes="(min-width: 900px) 360px, 46vw" />
              </button>
            </Reveal>
          ))}
        </ul>
      </div>
      <PortfolioLightbox photos={portfolio} index={openIndex} onChange={setOpenIndex} onClose={close} messages={messages.viewer} locale={locale} />
    </section>
  );
}
