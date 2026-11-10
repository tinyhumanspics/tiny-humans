"use client";

import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { bundlesHref, scheduleHref } from "@/config/booking";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import OfferLine from "@/features/booking/OfferLine";
import { formatLongDate } from "@/lib/booking/dates";
import { activeOffer, toCents } from "@/lib/pricing/engine";
import { requestBookingScroll } from "@/lib/scroll/booking";
import { activeSeasonalOffers } from "@/lib/seasonal/offers";
import { trackSelectBundle } from "@/lib/tracking/client";
import styles from "./SeasonalOffers.module.css";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * The seasonal offer boxes (owner-managed in /admin → Seasonal Landing) on the ad page and the home page: switched on,
 * before their last session date, made for the live theme (or any theme). Inside each box, the running bundle special
 * offer's line when there is one ("Thanksgiving offer: 10% off every bundle…", owner Nov 10). Nothing when none is live.
 */
export default function SeasonalOffers({ messages, promoMessages, locale, className }: { messages: typeof en.landing.seasonalOffers; promoMessages: typeof en.bundlesPage.promo; locale: AppLocale; className?: string }) {
  const { bundles, today } = useCatalog();
  const { settings, theme } = useSiteSettings();
  const offers = activeSeasonalOffers(settings.seasonalOffers, theme.id, today, locale);
  if (!offers.length) return null;
  const featured = bundles.find((b) => b.badge) ?? bundles[0];
  const ctaHref = featured ? scheduleHref(featured.id, null, locale) : bundlesHref(null, locale);
  const onCta = () => {
    if (featured) trackSelectBundle({ id: featured.id, name: featured.name, value: (activeOffer(featured, today)?.cents ?? toCents(featured.price)) / 100 });
    requestBookingScroll();
  };
  return (
    <section className={cn("container", styles.seasonal, className)} aria-labelledby="seasonal-offer">
      <Reveal>
        <p className={cn(styles.seasonalEyebrow, "chalk-soft")}>{messages.eyebrow}</p>
        <div className={styles.seasonalGrid}>
          {offers.map((offer, index) => (
            <ChalkBox key={offer.id} className={styles.seasonalCard} seed={24 + index} wobble={2.4} strokeWidth={2.6} color="var(--sun-yellow)">
              <ChalkDoodle name="sparkle" size={30} color="var(--accent-2)" strokeWidth={3} className={styles.seasonalDoodle} grain={false} />
              <h2 id={index === 0 ? "seasonal-offer" : undefined} className={cn(styles.seasonalTitle, "chalk")}>{offer.title}</h2>
              <p className={cn(styles.seasonalDescription, "chalk-soft")}>{offer.description}</p>
              <p className={cn(styles.seasonalCutoff, "chalk-soft")}>{fill(messages.cutoff, { date: formatLongDate(offer.cutoff, locale) })}</p>
              {/* own wrapper: two CSS modules on one element can override each other in either order */}
              <div className={styles.seasonalPromo}>
                <OfferLine messages={promoMessages} locale={locale} />
              </div>
              <ChalkButton href={ctaHref} onClick={onCta} variant="outline" seed={26 + index}>{messages.cta}</ChalkButton>
            </ChalkBox>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
