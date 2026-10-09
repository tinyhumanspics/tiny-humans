"use client";

import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { scheduleHref } from "@/config/booking";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import BundleCard from "@/components/BundleCard/BundleCard";
import { useBookingSelection } from "@/components/Booking/BookingSelectionContext";
import BookingPaused from "@/features/booking/BookingPaused";
import styles from "./Bundles.module.css";

/** Step one of booking: pick a bundle. Each card leads to the calendar. */
export default function Bundles({ messages, locale }: { messages: typeof en.bundlesPage; locale: AppLocale }) {
  const id = "bundles";
  const { inspirationId } = useBookingSelection();
  const { bundles, available } = useCatalog();
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.section.title} subtitle={messages.section.subtitle} slot="bundles" />
        {available ? (
          <div className={styles.grid}>
            {bundles.map((bundle, i) => (
              <BundleCard key={bundle.id} bundle={bundle} index={i} messages={messages.card} locale={locale} href={scheduleHref(bundle.id, inspirationId, locale)} />
            ))}
          </div>
        ) : (
          <BookingPaused messages={messages.paused} />
        )}
      </div>
    </section>
  );
}
