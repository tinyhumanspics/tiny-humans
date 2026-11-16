"use client";

import Image from "next/image";
import en from "@/messages/en.json";
import { site } from "@/config/site";
import { scheduleHref } from "@/config/booking";
import type { PortfolioPhoto } from "@/config/portfolio";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import PinnedPhoto from "@/components/ui/PinnedPhoto/PinnedPhoto";
import Reveal from "@/components/layout/Reveal/Reveal";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import BookingPaused from "@/features/booking/BookingPaused";
import BundleCard from "@/features/booking/BundleCard";
import Reviews from "@/features/reviews/Reviews";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import { cn } from "@/lib/cn";
import { depositText, type SiteDeposit } from "@/lib/deposit/copy";
import { fill } from "@/lib/email/messages";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import type { Bundle } from "@/lib/pricing/types";
import type { PublicReview } from "@/lib/reviews/public";
import { trackSelectBundle } from "@/lib/tracking/client";
import type { TravelSettings } from "@/lib/travel/types";
import styles from "./Landing.module.css";

/** Ad concepts for message match (?c= on the ad link): the H1 and subhead change, nothing else. */
export type LandingConcept = "a" | "b" | "c";

/** Admin photo names that are file names ("IMG 6087", "UPDATED 10") never become alt text, nor a "(placeholder)" tag. */
const altOf = (photo: PortfolioPhoto, fallback: string) => {
  const alt = photo.alt.replace(/\s*\((placeholder|foto provisional)\)\s*$/i, "").trim();
  return !alt || /^(img|dsc|updated|photo)[\s_-]*\d+$/i.test(alt) ? fallback : alt;
};

/** What a family pays at least today: the lowest landing bundle, at its running offer if any. */
const priceCents = (b: Bundle, today: string) => activeOffer(b, today)?.cents ?? toCents(b.price);

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
  locale?: AppLocale;
}) {
  const t = messages;
  const { bundles, today, available } = useCatalog();
  const { media } = useSiteSettings();
  const notice = noticeLabel(noticeHours, noticeMessages);
  const money = (cents: number) => formatMoney(cents);

  // the bundles the owner shows here, cheapest first; the middle one is the one the page sends people to
  const shown = bundles.filter((b) => b.showOnLanding !== false).sort((a, b) => priceCents(a, today) - priceCents(b, today));
  const featured = shown[Math.floor((shown.length - 1) / 2)] ?? bundles[0];
  const withQuery = (href: string) => (query ? `${href}&${query}` : href);
  const ctaHref = featured ? withQuery(scheduleHref(featured.id, null, locale)) : `${localePath("/book", locale)}${query ? `?${query}` : ""}`;
  const onCta = (b: Bundle | undefined = featured) => {
    if (b) trackSelectBundle({ id: b.id, name: b.name, value: priceCents(b, today) / 100 });
  };

  // "From $299 · $50 holds your date, refundable up to 48 hours before · Free travel within 30 miles of Miami Beach"
  const lowest = shown.length ? Math.min(...shown.map((b) => priceCents(b, today))) : null;
  const priceLine = [
    lowest !== null ? fill(t.price.from, { price: money(lowest) }) : null,
    deposit ? fill(depositText(t.price.deposit, deposit), { notice }) : null,
    travel ? fill(t.price.travel, { miles: String(travel.freeMiles) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const perMile = travel ? money(travel.perMileCents) : "";
  const twins = shown.find((b) => b.extraBaby?.active)?.extraBaby;

  // owner photos only: an empty slot shows nothing here (no "photo coming soon" card on the ad page)
  const [whyPhoto, meetPhoto] = media.landing;
  const hero = media.landing[2] ?? media.gallery[0] ?? media.title[0] ?? null;
  const proof = reviews[0];
  const proofText = proof ? (proof.body.length > 170 ? `${proof.body.slice(0, 167).replace(/\s+\S*$/, "")}…` : proof.body) : "";
  const words = t.hero.concepts[concept] ?? t.hero.concepts.a;
  const gallery = media.gallery.slice(0, 9);

  const textUs = (
    <p className={cn(styles.textUs, "chalk-soft")}>
      {t.textUs}{" "}
      <a href={`sms:${site.contact.sms}`} className={styles.textLink}>
        {site.contact.phone}
      </a>
    </p>
  );

  return (
    <main id="top" className={styles.page}>
      {/* 1. Hero: a real photo, what it is, the price, one proof line, one button */}
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={cn("container", styles.heroGrid)}>
          {hero && (
            <div className={styles.heroPhoto}>
              <Image src={hero.src} alt={altOf(hero, t.hero.photo)} fill priority sizes="(min-width: 900px) 46vw, 100vw" className={styles.heroImg} />
            </div>
          )}
          <div className={styles.heroCopy}>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{t.hero.eyebrow}</p>
            <h1 id="landing-title" className={cn(styles.title, "chalk")}>
              {words.title}
            </h1>
            <p className={cn(styles.sub, "chalk-soft")}>{words.sub}</p>
            <div className={styles.actions}>
              <ChalkButton href={ctaHref} onClick={() => onCta()} variant="solid" seed={12}>
                {t.hero.cta}
              </ChalkButton>
            </div>
            {priceLine && <p className={cn(styles.priceLine, "chalk-soft")}>{priceLine}</p>}
            {proof && (
              <figure className={styles.proof}>
                <blockquote lang={proof.lang} className="chalk-soft">
                  “{proofText}”
                </blockquote>
                <figcaption className="chalk-soft">
                  — {proof.displayName}
                  {proof.lang !== locale ? ` (${t.proofLang[proof.lang]})` : ""}
                </figcaption>
              </figure>
            )}
            {textUs}
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
      <section className={cn("container", styles.section)} aria-labelledby="landing-why">
        <SectionHeading id="landing-why" title={t.why.title} slot="book" />
        <div className={cn(styles.why, !whyPhoto && styles.whySolo)}>
          <div>
            <p className={cn(styles.text, "chalk-soft")}>{t.why.text}</p>
            <p className={cn(styles.text, "chalk-soft")}>
              {t.why.space.split("{strong}")[0]}
              <b>{t.why.spaceStrong}</b>
              {t.why.space.split("{strong}")[1]}
            </p>
          </div>
          {whyPhoto && (
            <Reveal className={styles.whyPhoto}>
              <PinnedPhoto photo={{ ...whyPhoto, alt: altOf(whyPhoto, t.why.photo) }} seed={45} sizes="(min-width: 900px) 520px, 100vw" showCaption={false} tape="white" />
            </Reveal>
          )}
        </div>
      </section>

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
                <BundleCard bundle={{ ...b, cta: t.hero.cta }} index={i} messages={bundleMessages.card} locale={locale} href={withQuery(scheduleHref(b.id, null, locale))} />
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
            {twins && <p className={cn(styles.small, "chalk-soft")}>{fill(t.offer.twins, { price: money(toCents(twins.price)) })}</p>}
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
      <Reviews reviews={reviews} messages={reviewMessages} placement="landing" />

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
          {textUs}
        </ChalkBox>
      </section>
    </main>
  );
}
