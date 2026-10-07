"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { useBookingSelection } from "./BookingSelectionContext";
import Booking from "./Booking";
import BookingPaused from "@/features/booking/BookingPaused";
import styles from "./Booking.module.css";

/** Reads ?bundle= and ?inspiration= from the link, then shows the calendar. */
export default function ScheduleBooking() {
  const params = useSearchParams();
  const { photos } = useSiteSettings();
  const { setInspirationId } = useBookingSelection();
  const { getBundle, available } = useCatalog();
  const bundle = getBundle(params.get("bundle"));
  const inspirationId = params.get("inspiration");

  useEffect(() => {
    if (inspirationId && findPhoto(photos, inspirationId)) setInspirationId(inspirationId);
  }, [inspirationId, photos, setInspirationId]);

  if (!bundle && !available) {
    return (
      <section className={styles.section}>
        <div className="container">
          <BookingPaused />
        </div>
      </section>
    );
  }
  if (!bundle) {
    return (
      <section className={styles.section} aria-labelledby="pick-bundle-title">
        <div className="container">
          <ChalkBox className={styles.noBundle} seed={77} wobble={3} strokeWidth={2.6}>
            <h1 id="pick-bundle-title" className={`${styles.stepTitle} chalk`}>Choose a bundle first</h1>
            <p className="chalk-soft">Pick the bundle that fits your family, and we&apos;ll show you the open dates.</p>
            <ChalkButton href="/book" variant="solid" seed={78}>
              See the bundles
            </ChalkButton>
          </ChalkBox>
        </div>
      </section>
    );
  }
  // key: a different bundle starts a fresh booking
  return <Booking key={bundle.id} bundleId={bundle.id} />;
}
