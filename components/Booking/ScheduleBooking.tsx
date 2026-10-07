"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import { useBookingSelection } from "./BookingSelectionContext";
import Booking from "./Booking";
import BookingPaused from "@/features/booking/BookingPaused";
import { bundlesHref, scheduleHref } from "@/config/booking";
import { lastBundle, rememberBundle } from "@/lib/booking/last-bundle";
import styles from "./Booking.module.css";

/**
 * Reads ?bundle= and ?inspiration= from the link, then shows the calendar.
 * No (known) bundle in the link: back to the bundle opened earlier in this visit, otherwise to the bundles page.
 */
export default function ScheduleBooking() {
  const params = useSearchParams();
  const router = useRouter();
  const { photos } = useSiteSettings();
  const { setInspirationId } = useBookingSelection();
  const { getBundle, available } = useCatalog();
  const bundle = getBundle(params.get("bundle"));
  const bundleId = bundle?.id;
  const inspirationId = params.get("inspiration");
  const redirected = useRef(false);

  useEffect(() => {
    if (inspirationId && findPhoto(photos, inspirationId)) setInspirationId(inspirationId);
  }, [inspirationId, photos, setInspirationId]);

  useEffect(() => {
    if (bundleId) {
      rememberBundle(bundleId);
      redirected.current = false;
      return;
    }
    if (!available || redirected.current) return;
    redirected.current = true;
    const last = getBundle(lastBundle());
    router.replace(last ? scheduleHref(last.id, inspirationId) : bundlesHref(inspirationId));
  }, [bundleId, available, getBundle, inspirationId, router]);

  if (!bundle && !available) {
    return (
      <section className={styles.section}>
        <div className="container">
          <BookingPaused />
        </div>
      </section>
    );
  }
  // on its way to the right page (see above)
  if (!bundle) return null;
  // key: a different bundle starts a fresh booking
  return <Booking key={bundle.id} bundleId={bundle.id} />;
}
