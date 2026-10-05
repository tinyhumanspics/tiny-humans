"use client";

import { bundles } from "@/config/bundles";
import { scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import BundleCard from "@/components/BundleCard/BundleCard";
import { useBookingSelection } from "@/components/Booking/BookingSelectionContext";
import styles from "./Bundles.module.css";

/** Step one of booking: pick a bundle. Each card leads to the calendar. */
export default function Bundles() {
  const { id, title, subtitle } = site.sections.bundles;
  const { inspirationId } = useBookingSelection();
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={title} subtitle={subtitle} slot="bundles" />
        <div className={styles.grid}>
          {bundles.map((bundle, i) => (
            <BundleCard key={bundle.id} bundle={bundle} index={i} href={scheduleHref(bundle.id, inspirationId)} />
          ))}
        </div>
      </div>
    </section>
  );
}
