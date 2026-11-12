"use client";

import { useRef, useState } from "react";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import PinnedPhoto from "@/components/ui/PinnedPhoto/PinnedPhoto";
import PortfolioLightbox from "@/features/home/PortfolioLightbox";
import Reveal from "@/components/layout/Reveal/Reveal";
import BoardScene from "@/components/chalk/BoardDoodles/BoardScene";
import { fill } from "@/lib/email/messages";
import type { AppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import styles from "./Portfolio.module.css";

const tapes = ["yellow", undefined, "blue", undefined, "white", "yellow", undefined, "blue", undefined] as const;

/**
 * Home page "Little moments" (the Portfolio link): one gallery of every picture, 3 per row (owner, Nov 11: no "Book a
 * memory like this one" boxes). A parent taps a picture to see it whole and can use it as the inspiration for their
 * session (the viewer's button opens the bundles with it picked).
 */
export default function Portfolio({ messages = en.home.portfolio, locale = "en" }: { messages?: typeof en.home.portfolio; locale?: AppLocale }) {
  const id = "portfolio";
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const { photos: portfolio } = useSiteSettings();

  const close = () => {
    const i = openIndex;
    setOpenIndex(null);
    if (i !== null) triggers.current[i]?.focus({ preventScroll: true });
  };

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.title} subtitle={messages.subtitle} slot="portfolio" />
        {portfolio.length > 0 && <p className={cn(styles.pickHint, "chalk-soft")}>{messages.pickHint}</p>}
        <ul className={styles.grid} data-odd={portfolio.length % 2 === 1} data-short={portfolio.length % 3 !== 0}>
          {portfolio.map((photo, i) => (
            <Reveal as="li" key={photo.id} className={styles.item} delay={(i % 3) * 90}>
              <button
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                type="button"
                className={styles.trigger}
                onClick={() => setOpenIndex(i)}
                aria-label={fill(messages.openPhoto, { current: String(i + 1), total: String(portfolio.length), alt: photo.alt })}
              >
                <PinnedPhoto photo={photo} seed={100 + i} tape={tapes[i % tapes.length]} sizes="(min-width: 1024px) 360px, (min-width: 600px) 45vw, 92vw" />
              </button>
            </Reveal>
          ))}
          {/* fills the empty spot left in two-column (and short) rows */}
          <li className={styles.sceneCell} aria-hidden="true">
            <BoardScene index={0} />
          </li>
        </ul>
      </div>
      <PortfolioLightbox photos={portfolio} index={openIndex} onChange={setOpenIndex} onClose={close} messages={messages.viewer} locale={locale} />
    </section>
  );
}
