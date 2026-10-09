"use client";

import type { Bundle } from "@/config/bundles";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import { formatLongDate } from "@/lib/booking/dates";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { trackSelectBundle } from "@/lib/tracking/client";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/Reveal/Reveal";
import { requestBookingScroll } from "@/lib/scroll/booking";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import styles from "./BundleCard.module.css";
import { cn } from "@/lib/cn";

interface Props {
  bundle: Bundle;
  index: number;
  messages: typeof en.bundlesPage.card;
  locale: AppLocale;
  /** Where "Choose …" goes: the booking calendar for this bundle. */
  href: string;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** A package box drawn on the board. Every word inside is chalk. */
export default function BundleCard({ bundle, index, messages, locale, href }: Props) {
  const { theme } = useSiteSettings();
  const { today } = useCatalog();
  // date-based only: the offer shows while enabled and today is on/before its end date
  const offer = activeOffer(bundle, today);
  const doodle = theme.decorations.cards[index % 3];
  const featured = Boolean(bundle.badge);
  const titleId = `bundle-${bundle.id}`;
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
          <h3 id={titleId} className={styles.name}>{bundle.name}</h3>
          {bundle.description && <p className={styles.description}>{bundle.description}</p>}
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
          <ul className={styles.features}>
            {bundle.features.map((f, fi) => (
              <li key={`${fi}-${f}`}>
                <ChalkDoodle grain={false} name="check" size={24} color="var(--sun-yellow)" strokeWidth={4.6} className={styles.check} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
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
            requestBookingScroll();
          }}
          className={styles.cta}
          seed={60 + index}
          aria-describedby={titleId}
        >
          {bundle.cta}
        </ChalkButton>
      </ChalkBox>
    </article>
    </Reveal>
  );
}
