"use client";

import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import Reveal from "@/components/Reveal/Reveal";
import { useBookingSelection } from "./BookingSelectionContext";
import InspirationThumb from "./InspirationThumb";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

/** Shown at the top of /book when the visitor came from a portfolio photo. */
export default function InspirationBanner() {
  const { inspirationId, setInspirationId } = useBookingSelection();
  const { photos } = useSiteSettings();
  const photo = findPhoto(photos, inspirationId);
  if (!photo) return null;
  return (
    <div className={cn("container", styles.bannerWrap)}>
      <Reveal>
        <ChalkBox className={styles.banner} seed={501} wobble={2.6} strokeWidth={2.4} color="var(--cloud-blue)">
          <InspirationThumb photo={photo} size={84} />
          <div className={cn(styles.bannerText, "chalk-soft")}>
            <p className={styles.bannerTitle}>You picked &ldquo;{photo.title}&rdquo;</p>
            <p className={styles.bannerSub}>We&apos;ll plan your session around it. Choose a bundle below.</p>
          </div>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setInspirationId(null)}>
            Remove
          </button>
        </ChalkBox>
      </Reveal>
    </div>
  );
}
