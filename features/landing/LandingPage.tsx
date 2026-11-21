"use client";

import Image from "next/image";
import en from "@/messages/en.json";
import { scheduleHref } from "@/config/booking";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import BoardDoodles from "@/components/chalk/BoardDoodles/BoardDoodles";
import PinnedPhoto from "@/components/ui/PinnedPhoto/PinnedPhoto";
import Reveal from "@/components/layout/Reveal/Reveal";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import BookingPaused from "@/features/booking/BookingPaused";
import BundleCard from "@/features/booking/BundleCard";
import Reviews from "@/features/reviews/Reviews";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { depositText, type SiteDeposit } from "@/lib/deposit/copy";
import { fill } from "@/lib/email/messages";
import { formatMoney, toCents } from "@/lib/pricing/engine";
import type { PublicReview } from "@/lib/reviews/public";
import type { TravelSettings } from "@/lib/travel/types";
import styles from "./Landing.module.css";
import { ProofLine, TextUs } from "./HeroBits";
import { altOf } from "@/config/media";
import WhyAtHome from "./WhyAtHome";
import { useLandingOffer } from "./offer";

/** Ad concepts for message match (?c= on the ad link): the H1 and subhead change, nothing else. */
export type LandingConcept = "a" | "b" | "c";


/**
 * The ad landing page (/home-sweet-home, brief 05), section by section from the copy draft: hero (real photo, H1, "Check
 * dates", the price line, one real review, "Text us") → trust → why at home → the work → bundles → how it works → who's
 * coming → reviews → FAQ → where we go → final call. Every price and amount comes from /admin; facts the owner hasn't
 * confirmed aren't on the page. `query`: the incoming link's parameters (utm, ad ids), kept on every "Check dates".
 */
export default function LandingPage({
  noticeHours,
  travel,
  deposit = null,
  reviews = [],
  concept = "a",
  query = "",
  messages = en.landing,
  bundleMessages = en.bundlesPage,
  noticeMessages = en.policy,
  reviewMessages = en.reviewsSection,
  heading,
  locale = "en",
}: {
  noticeHours: number;
  travel: TravelSettings | null;
  deposit?: SiteDeposit | null;
  reviews?: PublicReview[];
  concept?: LandingConcept;
  query?: string;
  messages?: typeof en.landing;
  bundleMessages?: typeof en.bundlesPage;
  noticeMessages?: Pick<typeof en.policy, "hour" | "hours">;
  reviewMessages?: typeof en.reviewsSection;
  /** The home page (owner, Nov 16): the same page with "Tiny moments. Big memories." as the title, one line each. */
  heading?: { title: string[] };
  locale?: AppLocale;
}) {
  const t = messages;
  const { media } = useSiteSettings();
  const money = (cents: number) => formatMoney(cents);
  // the bundles shown here (cheapest first), "Check dates" (the middle one) and the price line, as on the home page
  const { shown, withQuery, ctaHref, onCta, priceLine, notice, available } = useLandingOffer({ noticeHours, travel, deposit, query, priceMessages: t.price, noticeMessages, locale });
  const perMile = travel ? money(travel.perMileCents) : "";
  // twins: the extra price, and its extra time and photos when every bundle adds the same (owner, Nov 16)
  const extras = shown.flatMap((b) => (b.extraBaby?.active ? [b.extraBaby] : []));
  const twins = extras[0];
  const samePerks = Boolean(twins) && twins.extraMinutes > 0 && twins.extraPhotos > 0 && extras.every((e) => e.price === twins.price && e.extraMinutes === twins.extraMinutes && e.extraPhotos === twins.extraPhotos);

  // owner photos only: an empty slot shows nothing here (no "photo coming soon" card on the ad page)
  const meetPhoto = media.landing[1];
  const hero = media.landing[2] ?? media.gallery[0] ?? media.title[0] ?? null;
  const words = t.hero.concepts[concept] ?? t.hero.concepts.a;
  // the photos ticked "on the ad page" in /admin: the same on the ad page and the home page (owner, Nov 16)
  const gallery = media.gallery.slice(0, 9);

  return (
    <main id="top" className={styles.page}>
      {/* 1. Hero: a real photo, what it is, the price, one proof line, one button */}
      {/* the home page's top animates in (owner, Nov 16): the photo settles, the title writes itself, the rest rises */}
      <section className={cn(styles.hero, heading && styles.animate)} aria-labelledby="landing-title">
        <div className={cn("container", styles.heroGrid)}>
          {hero && (
            <div className={styles.heroPhoto}>
              <Image src={hero.src} alt={altOf(hero, t.hero.photo)} fill loading="eager" fetchPriority="high" sizes="(min-width: 900px) 46vw, 100vw" className={styles.heroImg} />
            </div>
          )}
          <div className={styles.heroCopy}>
            <BoardDoodles area="hero" />
            <h1 id="landing-title" className={cn(styles.title, "chalk")}>
              {heading
                ? heading.title.map((line) => (
                    <span key={line} className={styles.titleLine}>
                      {line}
                    </span>
                  ))
                : words.title}
            </h1>
            <p className={cn(styles.sub, "chalk-soft")}>{words.sub}</p>
            <div className={styles.actions}>
              <ChalkButton href={ctaHref} onClick={() => onCta()} variant="solid" seed={12}>
                {t.hero.cta}
              </ChalkButton>
            </div>
            {priceLine && <p className={cn(styles.priceLine, "chalk-soft")}>{priceLine}</p>}
            <ProofLine review={reviews[0]} locale={locale} langs={t.proofLang} />
            <TextUs text={t.textUs} />
          </div>
        </div>
      </section>

      {/* 2. Trust strip */}
      <section className="container" aria-label={t.trustLabel}>
        <ul className={styles.trust}>
          {t.trust.map((item) => (
            <li key={item} className="chalk-soft">
              <ChalkDoodle name="check" size={22} color="var(--sun-yellow)" strokeWidth={3.4} grain={false} />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Why at home */}
      <WhyAtHome messages={t.why} id="landing-why" />

      {/* 4. The work: real sessions, full phone width */}
      {gallery.length > 0 && (
        <section className={cn("container", styles.section)} aria-labelledby="landing-work">
          <SectionHeading id="landing-work" title={t.work.title} subtitle={t.work.sub} slot="portfolio" />
          <ul className={styles.work}>
            {gallery.map((photo, i) => (
              <Reveal as="li" key={photo.id} delay={(i % 3) * 80}>
                <PinnedPhoto photo={{ ...photo, alt: altOf(photo, t.work.title) }} seed={300 + i} sizes="(min-width: 900px) 360px, 100vw" showCaption={false} tape={i % 2 ? "blue" : "yellow"} />
              </Reveal>
            ))}
          </ul>
          <div className={styles.centerCta}>
            <ChalkButton href={ctaHref} onClick={() => onCta()} variant="solid" seed={31}>
              {t.hero.cta}
            </ChalkButton>
          </div>
        </section>
      )}

      {/* 5. The offer */}
      <section id="bundles" className={cn("container", styles.section)} aria-labelledby="landing-bundles">
        <SectionHeading id="landing-bundles" title={t.offer.title} slot="bundles" />
        {available && shown.length ? (
          <div className={styles.bundles}>
            {shown.map((b, i) => (
              <div key={b.id} onClickCapture={() => onCta(b)}>
                <BundleCard bundle={b} cta={t.hero.cta} index={i} messages={bundleMessages.card} locale={locale} href={withQuery(scheduleHref(b.id, null, locale))} />
              </div>
            ))}
          </div>
        ) : (
          <BookingPaused messages={bundleMessages.paused} />
        )}
        <Reveal>
          <ChalkBox className={styles.includes} seed={55} wobble={2.6} strokeWidth={2.6} color="var(--sun-yellow)">
            <h3 className={cn(styles.boxTitle, "chalk")}>{t.offer.includesTitle}</h3>
            <ul className={styles.ticks}>
              {t.offer.includes.map((line) => (
                <li key={line} className="chalk-soft">
                  <ChalkDoodle name="sparkle" size={22} color="var(--sun-yellow)" strokeWidth={3} grain={false} />
                  {line}
                </li>
              ))}
            </ul>
            <p className="chalk-soft">
              <b>{t.offer.promiseTitle}:</b> {t.offer.promise}
            </p>
            <p className="chalk-soft">
              <b>{t.offer.dueTitle}</b> {t.offer.due} {deposit ? depositText({ one: t.offer.dueDeposit, from: t.offer.dueDeposit }, deposit) : ""}
            </p>
            {twins && <p className={cn(styles.small, "chalk-soft")}>{fill(samePerks ? t.offer.twinsPerks : t.offer.twins, { price: money(toCents(twins.price)), minutes: String(twins.extraMinutes), photos: String(twins.extraPhotos) })}</p>}
            {travel && <p className={cn(styles.small, "chalk-soft")}>{fill(t.offer.travel, { miles: String(travel.freeMiles), perMile })}</p>}
          </ChalkBox>
        </Reveal>
      </section>

      {/* 6. How it works (request first) */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-how">
        <SectionHeading id="landing-how" title={t.how.title} slot="book" />
        <ol className={styles.steps}>
          {t.how.steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90}>
              <ChalkBox className={styles.step} seed={40 + i} wobble={2.6} strokeWidth={2.4}>
                <span className={cn(styles.stepNum, "chalk")} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={cn(styles.stepTitle, "chalk-soft")}>{s.title}</h3>
                <p className="chalk-soft">
                  {s.text}
                  {i === 1 && deposit ? ` ${fill(depositText(t.how.deposit, deposit), { notice })}` : ""}
                </p>
              </ChalkBox>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* 7. Who's coming into your home */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-meet">
        <ChalkBox className={cn(styles.meet, !meetPhoto && styles.meetSolo)} seed={61} wobble={2.6} strokeWidth={2.4}>
          {meetPhoto && (
            <div className={styles.meetPhoto}>
              <PinnedPhoto photo={{ ...meetPhoto, alt: altOf(meetPhoto, t.meet.photo) }} seed={62} sizes="(min-width: 900px) 320px, 100vw" showCaption={false} tape="yellow" />
            </div>
          )}
          <div>
            <h2 id="landing-meet" className={cn(styles.meetTitle, "chalk")}>
              {t.meet.title}
            </h2>
            <p className="chalk-soft">{t.meet.body}</p>
            <h3 className={cn(styles.boxTitle, "chalk")}>{t.meet.standardsTitle}</h3>
            <ul className={styles.ticks}>
              {t.meet.standards.map((line) => (
                <li key={line} className="chalk-soft">
                  <ChalkDoodle name="check" size={20} color="var(--sun-yellow)" strokeWidth={3.4} grain={false} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </ChalkBox>
        <div className={styles.centerCta}>
          <ChalkButton href={ctaHref} onClick={() => onCta()} variant="solid" seed={64}>
            {t.hero.cta}
          </ChalkButton>
        </div>
      </section>

      {/* 8. Reviews: only the ones picked in /admin (the family said OK) */}
      <Reviews reviews={reviews} messages={reviewMessages} locale={locale} langs={t.proofLang} />

      {/* 9. FAQ */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-faq">
        <SectionHeading id="landing-faq" title={t.faq.title} slot="portfolio" align="center" />
        <div className={styles.faq}>
          {t.faq.items.map((f) => {
            const answer = (!deposit && "aNoDeposit" in f ? f.aNoDeposit : undefined) ?? f.a;
            return (
              <details key={f.q} className={styles.faqItem}>
                <summary className="chalk-soft">{f.q}</summary>
                <p className="chalk-soft">{fill(deposit ? depositText({ one: answer, from: answer }, deposit) : answer, { notice })}</p>
              </details>
            );
          })}
        </div>
      </section>

      {/* 10. Where we go: Miami first; the rest of Florida with its fee */}
      <section className={cn("container", styles.section)} aria-labelledby="landing-area">
        <SectionHeading id="landing-area" title={t.area.title} slot="book" />
        <p className={cn(styles.text, "chalk-soft")}>{t.area.based}</p>
        <ul className={styles.cities}>
          {t.area.cities.map((c) => (
            <li key={c} className="chalk-soft">
              {c}
            </li>
          ))}
        </ul>
        {travel && (
          <>
            <p className={cn(styles.text, "chalk-soft")}>{fill(t.area.free, { miles: String(travel.freeMiles) })}</p>
            <p className={cn(styles.small, "chalk-soft")}>{fill(t.area.florida, { miles: String(travel.freeMiles), perMile })}</p>
          </>
        )}
      </section>

      {/* 11. Final call */}
      <section className={cn("container", styles.section, styles.finalSection)} aria-labelledby="landing-final">
        <ChalkBox className={styles.final} seed={71} wobble={3} strokeWidth={3} color="var(--sun-yellow)">
          <h2 id="landing-final" className={cn(styles.finalTitle, "chalk")}>
            {t.final.title}
          </h2>
          <p className="chalk-soft">{t.final.text}</p>
          <ChalkButton href={ctaHref} onClick={() => onCta()} variant="solid" seed={72}>
            {t.hero.cta}
          </ChalkButton>
          {priceLine && <p className={cn(styles.priceLine, "chalk-soft")}>{priceLine}</p>}
          <TextUs text={t.textUs} />
        </ChalkBox>
      </section>
    </main>
  );
}
