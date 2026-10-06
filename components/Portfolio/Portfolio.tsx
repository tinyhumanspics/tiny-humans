"use client";

import { useRef, useState } from "react";
import { buildFeedFromMedia } from "@/config/media";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import { site } from "@/config/site";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import PinnedPhoto from "@/components/PinnedPhoto/PinnedPhoto";
import PortfolioLightbox from "@/components/PortfolioLightbox/PortfolioLightbox";
import PortfolioCta from "@/components/PortfolioCta/PortfolioCta";
import Reveal from "@/components/Reveal/Reveal";
import BoardScene from "@/components/BoardDoodles/BoardScene";
import styles from "./Portfolio.module.css";

const tapes = ["yellow", undefined, "blue", undefined, "white", "yellow", undefined, "blue", undefined] as const;

/** Home page feed: photo groups with "Book a memory like this one" prompts between them. */
export default function Portfolio() {
  const { id, title, subtitle } = site.sections.portfolio;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const { photos: portfolio, media } = useSiteSettings();
  const feed = buildFeedFromMedia(media);

  const close = () => {
    const i = openIndex;
    setOpenIndex(null);
    if (i !== null) triggers.current[i]?.focus({ preventScroll: true });
  };

  let ctaCount = 0;
  let groupCount = 0;

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={title} subtitle={subtitle} slot="portfolio" />
        {feed.map((block, b) => {
          if (block.type === "cta") {
            ctaCount += 1;
            return <PortfolioCta key={`cta-${b}`} photo={block.photo} title={block.title} text={block.text} seed={700 + ctaCount} flip={ctaCount % 2 === 0} />;
          }
          const groupIndex = groupCount++;
          return (
            <ul key={`group-${b}`} className={styles.grid} data-odd={block.photos.length % 2 === 1} data-short={block.photos.length % 3 !== 0}>
              {block.photos.map((photo, j) => {
                const i = portfolio.indexOf(photo);
                return (
                  <Reveal as="li" key={photo.id} className={styles.item} delay={j * 90}>
                    <button
                      ref={(el) => {
                        triggers.current[i] = el;
                      }}
                      type="button"
                      className={styles.trigger}
                      onClick={() => setOpenIndex(i)}
                      aria-label={`Open photo ${i + 1} of ${portfolio.length}: ${photo.alt}`}
                    >
                      <PinnedPhoto photo={photo} seed={100 + i} tape={tapes[i % tapes.length]} sizes="(min-width: 1024px) 360px, (min-width: 600px) 45vw, 92vw" />
                    </button>
                  </Reveal>
                );
              })}
              {/* fills the empty spot left in two-column (and short) rows */}
              <li className={styles.sceneCell} aria-hidden="true">
                <BoardScene index={groupIndex} />
              </li>
            </ul>
          );
        })}
      </div>
      <PortfolioLightbox photos={portfolio} index={openIndex} onChange={setOpenIndex} onClose={close} />
    </section>
  );
}
