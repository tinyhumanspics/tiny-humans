"use client";

import en from "@/messages/en.json";
import { bundlesHref, scheduleHref } from "@/config/booking";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import PinnedPhoto from "@/components/PinnedPhoto/PinnedPhoto";
import PhotoPlaceholder from "@/components/PhotoPlaceholder/PhotoPlaceholder";
import Reveal from "@/components/Reveal/Reveal";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import BundleCard from "@/components/BundleCard/BundleCard";
import BookingPaused from "@/features/booking/BookingPaused";
import { activeOffer, toCents } from "@/lib/pricing/engine";
import { requestBookingScroll } from "@/lib/scroll/booking";
import { trackSelectBundle } from "@/lib/tracking/client";
import NextOpenDates from "./NextOpenDates";
import styles from "./Landing.module.css";
import { cn } from "@/lib/cn";

const t = en.landing;
/** Phone order: the family bundle first (price anchor), the "most loved" one highlighted. Desktop keeps the owner's order. */
const PHONE_ORDER = ["forever-little", "our-little-story", "little-moments"];
const tapes = ["yellow", "blue", undefined, "white", undefined, "yellow"] as const;

/** Ad landing page: hook → trust → proof → process → offer → people → questions → area → ask. */
export default function LandingPage() {
  const { bundles, today, available } = useCatalog();
  const { media, photos } = useSiteSettings();
  const featured = bundles.find((b) => b.badge) ?? bundles[0];
  const ctaHref = featured ? scheduleHref(featured.id) : bundlesHref();
  const onFeaturedCta = () => {
    if (featured) trackSelectBundle({ id: featured.id, name: featured.name, value: (activeOffer(featured, today)?.cents ?? toCents(featured.price)) / 100 });
    requestBookingScroll();
  };
  const [first, second] = media.title;
  const gallery = photos.filter((p) => p !== first && p !== second).slice(0, 6);

  return (
    <main id="top" className={styles.page}>
      {/* 1. Hero */}
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={cn("container", styles.heroGrid)}>
          <Reveal className={styles.heroCopy}>
            <BoardDoodles area="hero" />
            <p className={cn(styles.eyebrow, "chalk-soft")}>{t.hero.eyebrow}</p>
            <h1 id="landing-title" className={cn(styles.title, "chalk")}>
              {t.hero.title.map((line) => (
                <span key={line} className={styles.line}>{line}</span>
              ))}
            </h1>
            <ChalkDoodle name="underline" size={230} color="var(--sun-yellow)" strokeWidth={3} className={styles.underline} />
            <p className={cn(styles.sub, "chalk-soft")}>{t.hero.sub}</p>
            <div className={styles.actions}>
              <ChalkButton href={ctaHref} onClick={onFeaturedCta} variant="solid" seed={12}>{t.hero.cta}</ChalkButton>
              <ChalkButton href="#bundles" variant="outline" seed={11}>{t.hero.secondary}</ChalkButton>
            </div>
            <p className={cn(styles.ctaNote, "chalk-soft")}>{t.hero.ctaNote}</p>
          </Reveal>
          {first && second && (
            <Reveal className={styles.snaps} delay={200}>
              <div aria-hidden="true" className={styles.snapsInner}>
                <div className={styles.snapA}>
                  <PinnedPhoto photo={first} seed={21} sizes="(min-width: 900px) 300px, 46vw" priority showCaption={false} tape="yellow" />
                </div>
                <div className={styles.snapB}>
                  <PinnedPhoto photo={second} seed={22} sizes="(min-width: 900px) 320px, 50vw" priority showCaption={false} tape="blue" />
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* 2. Trust strip */}
      <section className="container" aria-label="Why families choose us">
        <Reveal>
          <ul className={styles.trust}>
            {t.trust.map((item) => (
              <li key={item} className="chalk-soft">
                <ChalkDoodle name="check" size={22} color="var(--sun-yellow)" strokeWidth={3.4} grain={false} />
                {item}
              </li>
            ))}
          </ul>
          <p className={cn(styles.spanish, "chalk-soft")}>{t.spanish}</p>
        </Reveal>
      </section>

      {/* 3. Proof: real sessions (the owner's /admin photos) */}
      {gallery.length > 0 && (
        <section className={cn("container", styles.section)} aria-labelledby="landing-portfolio">
          <SectionHeading id="landing-portfolio" title={t.portfolio.title} subtitle={t.portfolio.sub} slot="portfolio" />
          <ul className={styles.gallery} data-count={gallery.length}>
            {gallery.map((photo, i) => (
              <Reveal as="li" key={photo.id} delay={(i % 3) * 90}>
                <PinnedPhoto photo={photo} seed={300 + i} tape={tapes[i % tapes.length]} sizes="(min-width: 900px) 340px, 46vw" />
              </Reveal>
            ))}
          </ul>
          <div className={styles.centerCta}>
            <ChalkButton href="#bundles" variant="outline" seed={31}>{t.portfolio.cta}</ChalkButton>
          </div>
        </section>
      )}

      {/* 4. How it works */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-how">
        <SectionHeading id="landing-how" title={t.how.title} slot="book" />
        <ol className={styles.steps}>
          {t.how.steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 110}>
              <ChalkBox className={styles.step} seed={40 + i} wobble={2.6} strokeWidth={2.4}>
                <span className={cn(styles.stepNum, "chalk")} aria-hidden="true">{i + 1}</span>
                <h3 className={cn(styles.stepTitle, "chalk-soft")}>{s.title}</h3>
                <p className="chalk-soft">{s.text}</p>
              </ChalkBox>
            </Reveal>
          ))}
        </ol>
        <Reveal className={styles.howPhoto}>
          <PhotoPlaceholder label={t.how.photo} ratio={3 / 2} seed={45} tape="white" />
        </Reveal>
        <Reveal>
          <p className={cn(styles.after, "chalk-soft")}>
            <ChalkDoodle name="heart" size={24} color="var(--accent-2)" strokeWidth={3} grain={false} /> {t.how.after}
          </p>
        </Reveal>
      </section>

      {/* 5. The offer: bundles + what every session includes */}
      <section id="bundles" className={cn("container", styles.section)} aria-labelledby="landing-bundles">
        <SectionHeading id="landing-bundles" title={t.offer.title} subtitle={t.offer.sub} slot="bundles" />
        {available ? (
          <div className={styles.bundles}>
            {bundles.map((b, i) => (
              <div key={b.id} className={styles.bundleCell} style={{ "--phone-order": PHONE_ORDER.indexOf(b.id) === -1 ? 9 : PHONE_ORDER.indexOf(b.id) } as React.CSSProperties}>
                <BundleCard bundle={b} index={i} href={scheduleHref(b.id)} />
              </div>
            ))}
          </div>
        ) : (
          <BookingPaused />
        )}
        <p className={cn(styles.ctaNote, styles.center, "chalk-soft")}>{t.hero.ctaNote}</p>
        <Reveal className={styles.bonusWrap}>
          <ChalkBox className={styles.bonus} seed={55} wobble={2.6} strokeWidth={2.6} color="var(--sun-yellow)">
            <h3 className={cn(styles.bonusTitle, "chalk")}>{t.offer.bonusTitle}</h3>
            <ul className={styles.bonusList}>
              {t.offer.bonuses.map((b) => (
                <li key={b.title}>
                  <ChalkDoodle name="sparkle" size={24} color="var(--sun-yellow)" strokeWidth={3} grain={false} />
                  <span className="chalk-soft">
                    <b>{b.title}.</b> {b.text}
                  </span>
                </li>
              ))}
            </ul>
            <p className={cn(styles.promise, "chalk-soft")}>
              <b>{t.offer.promiseTitle}:</b> {t.offer.promise}
            </p>
            <p className={cn(styles.small, "chalk-soft")}>{t.offer.deliverNote}</p>
          </ChalkBox>
        </Reveal>
      </section>

      {/* 6. Meet the photographers */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-meet">
        <Reveal>
          <ChalkBox className={styles.meet} seed={61} wobble={2.6} strokeWidth={2.4}>
            <ChalkDoodle name="heart" size={44} color="var(--accent-2)" strokeWidth={3} className={styles.meetDoodle} />
            <div className={styles.meetPhoto}>
              <PhotoPlaceholder label={t.meet.photo} ratio={4 / 5} seed={62} tape="yellow" />
            </div>
            <div>
              <h2 id="landing-meet" className={cn(styles.meetTitle, "chalk")}>{t.meet.title}</h2>
              {t.meet.paragraphs.map((p) => (
                <p key={p.slice(0, 20)} className="chalk-soft">{p}</p>
              ))}
              <p className={cn(styles.spanishInline, "chalk-soft")}>{t.meet.spanish}</p>
            </div>
          </ChalkBox>
        </Reveal>
      </section>

      {/* 7. Reviews: hidden until real reviews exist */}

      {/* 8. FAQ */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-faq">
        <SectionHeading id="landing-faq" title={t.faq.title} slot="portfolio" />
        <div className={styles.faq}>
          {t.faq.items.map((f) => (
            <details key={f.q} className={styles.faqItem}>
              <summary className="chalk-soft">{f.q}</summary>
              <p className="chalk-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. Service area */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-area">
        <SectionHeading id="landing-area" title={t.area.title} subtitle={t.area.sub} slot="book" />
        <Reveal>
          <ul className={styles.cities}>
            {t.area.cities.map((c) => (
              <li key={c} className="chalk-soft">{c}</li>
            ))}
          </ul>
          <p className={cn(styles.small, "chalk-soft")}>{t.area.more}</p>
        </Reveal>
      </section>

      {/* 10. Final call to action, with real reasons to book now */}
      <section className={cn("container", styles.section, styles.finalSection)} aria-labelledby="landing-final">
        <Reveal>
          <ChalkBox className={styles.final} seed={71} wobble={3} strokeWidth={3} color="var(--sun-yellow)">
            <h2 id="landing-final" className={cn(styles.finalTitle, "chalk")}>{t.final.title}</h2>
            <NextOpenDates bundleId={featured?.id} label={t.final.nextDates} loading={t.final.loading} />
            <p className="chalk-soft">{t.final.cap}</p>
            <p className={cn(styles.small, "chalk-soft")}>{t.final.seasonal}</p>
            <ChalkButton href={ctaHref} onClick={onFeaturedCta} variant="solid" seed={72}>{t.final.cta}</ChalkButton>
            <p className={cn(styles.ctaNote, "chalk-soft")}>{t.final.ctaNote}</p>
          </ChalkBox>
        </Reveal>
      </section>
    </main>
  );
}
