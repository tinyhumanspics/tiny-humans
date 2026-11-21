"use client";

import { useCatalog } from "@/components/providers/CatalogProvider";
import { scheduleHref } from "@/config/booking";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import type en from "@/messages/en.json";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import BundleCard from "@/features/booking/BundleCard";
import OfferLine from "@/features/booking/OfferLine";
import { useBookingSelection } from "@/features/booking/flow/BookingSelectionContext";
import BookingPaused from "@/features/booking/BookingPaused";
import { bundleColumns } from "@/lib/pricing/columns";
import { shownBundles } from "@/lib/pricing/engine";
import styles from "./Bundles.module.css";

/**
 * Step one of booking: pick a bundle. Each card leads to the calendar. Due dates: one line under the heading (owner, Nov 16).
 * The same bundles as the home page and the ad page, in the same order (brief 05).
 */
export default function Bundles({ messages, locale }: { messages: typeof en.bundlesPage; locale: AppLocale }) {
  const id = "bundles";
  const { inspirationId } = useBookingSelection();
  const { bundles: all, today, available } = useCatalog();
  const bundles = shownBundles(all, today);
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.section.title} subtitle={messages.section.subtitle} slot="bundles" level={1} note={
            <>
              <OfferLine messages={messages.promo} locale={locale} />
              <a href={`${localePath("/book", locale)}?when=due`} className={styles.dueLink}>
                {messages.section.due} →
              </a>
            </>
          }
        />
        {available ? (
          <>
            <div className={styles.grid} style={bundleColumns(bundles.length)}>
              {bundles.map((bundle, i) => (
                <BundleCard key={bundle.id} bundle={bundle} index={i} messages={messages.card} locale={locale} href={scheduleHref(bundle.id, inspirationId, locale)} headingLevel={2} />
              ))}
            </div>
          </>
        ) : (
          <BookingPaused messages={messages.paused} />
        )}
      </div>
    </section>
  );
}
