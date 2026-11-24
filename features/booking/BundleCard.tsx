"use client";

import type { Bundle } from "@/lib/pricing/types";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import { formatLongDate } from "@/lib/booking/dates";
import { useCatalog } from "@/components/providers/CatalogProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { trackSelectBundle } from "@/lib/tracking/client";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import BoardDoodles from "@/components/chalk/BoardDoodles/BoardDoodles";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import { featuresWithLooks, looksOf } from "@/lib/pricing/looks";
import BundleLooks from "./BundleLooks";
import styles from "./BundleCard.module.css";
import { cn } from "@/lib/cn";

interface Props {
  bundle: Bundle;
  index: number;
  messages: typeof en.bundlesPage.card;
  locale: AppLocale;
  /** The button: "Check dates" (brief 05b), going to /book with this bundle picked. */
  cta: string;
  href: string;
  /** 2 when the cards sit directly under the page's main heading (the /bundles page). */
  headingLevel?: 2 | 3;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** A package box drawn on the board. Every word inside is chalk. */
export default function BundleCard({ bundle, index, messages, locale, cta, href, headingLevel = 3 }: Props) {
  const Name = headingLevel === 2 ? "h2" : "h3";
  const { theme } = useSiteSettings();
  const { today, depositFor } = useCatalog();
  const deposit = depositFor(bundle.id);
  // date-based only: the offer shows while enabled and today is on/before its end date
  const offer = activeOffer(bundle, today);
  const doodle = theme.decorations.cards[index % 3];
  const featured = Boolean(bundle.badge);
  const titleId = `bundle-${bundle.id}`;
  // what the bundle includes, look by look (owner, Nov 24): it replaces the "2 setups" line
  const looks = looksOf(bundle.description);
  return (
    <Reveal delay={index * 120} className={styles.revealWrap}>
    <BoardDoodles area="card" only={index} />
    <article className={cn(styles.card, featured ? styles.featured : "", offer ? styles.hasOffer : "")} aria-labelledby={titleId} data-index={index}>
      {offer && (
        <p className={styles.offerSticker} aria-hidden="true">
          <span>{offer.label}</span>
        </p>
      )}
      <ChalkBox className={styles.box} seed={40 + index * 7} wobble={3.4} strokeWidth={2.8}>
        <ChalkDoodle name={doodle} size={34} color={index === 1 ? "var(--accent-2)" : "var(--accent)"} className={styles.doodle} />
        <div className={cn(styles.content, "chalk")}>
          {bundle.badge && (
            <p className={styles.badge}>
              <ChalkDoodle grain={false} name="heart" size={18} color="var(--cloud-blue)" fill="var(--cloud-blue)" strokeWidth={2} />
              {bundle.badge}
            </p>
          )}
          <Name id={titleId} className={styles.name}>{bundle.name}</Name>
          {offer ? (
            <>
              <p className={styles.price}>
                <span className="visually-hidden">{fill(messages.offerPrice, { offer: offer.label, regular: formatMoney(toCents(bundle.price)), price: formatMoney(offer.cents) })}</span>
                <s className={styles.wasPrice} aria-hidden="true">{formatMoney(toCents(bundle.price))}</s>{" "}
                <span className={styles.offerPrice} aria-hidden="true">{formatMoney(offer.cents)}</span>
              </p>
              {offer.endsOn && <p className={styles.offerEnds}>{fill(messages.offerEnds, { date: formatLongDate(offer.endsOn, locale).replace(/^[^,]+, /, "") })}</p>}
            </>
          ) : (
            <p className={styles.price}>
              <span className="visually-hidden">{fill(messages.regularPrice, { price: formatMoney(toCents(bundle.price)) })}</span>
              <span aria-hidden="true">{formatMoney(toCents(bundle.price))}</span>
            </p>
          )}
          <ChalkDoodle grain={false} name="underline" size={120} color="var(--sun-yellow)" strokeWidth={3} className={styles.priceLine} />
          {deposit ? <p className={styles.deposit}>{fill(messages.deposit, { deposit: formatMoney(deposit) })}</p> : null}
          <ul className={styles.features}>
            {featuresWithLooks(bundle.features, looks, "drop").map((f, fi) => (
              <li key={`${fi}-${f}`}>
                <ChalkDoodle grain={false} name="check" size={24} color="var(--sun-yellow)" strokeWidth={4.6} className={styles.check} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {looks && <BundleLooks looks={looks} />}
          <p className={styles.location}>
            <ChalkDoodle grain={false} name="house" size={24} color="var(--cloud-blue)" strokeWidth={3.6} />
            <span>{bundle.locationNote}</span>
          </p>
        </div>
        <ChalkButton
          variant={featured ? "solid" : "outline"}
          href={href}
          onClick={() => {
            trackSelectBundle({ id: bundle.id, name: bundle.name, value: (offer?.cents ?? toCents(bundle.price)) / 100 });
          }}
          className={styles.cta}
          seed={60 + index}
          aria-describedby={titleId}
        >
          {cta}
        </ChalkButton>
      </ChalkBox>
    </article>
    </Reveal>
  );
}
