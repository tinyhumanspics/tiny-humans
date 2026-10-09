"use client";

import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import Reveal from "@/components/Reveal/Reveal";
import { useBookingSelection } from "./BookingSelectionContext";
import InspirationThumb from "./InspirationThumb";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";
import type en from "@/messages/en.json";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** Shown at the top of /book when the visitor came from a portfolio photo. */
export default function InspirationBanner({ messages }: { messages: typeof en.bundlesPage.inspiration }) {
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
            <p className={styles.bannerTitle}>{fill(messages.picked, { title: photo.title })}</p>
            <p className={styles.bannerSub}>{messages.body}</p>
          </div>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setInspirationId(null)}>
            {messages.remove}
          </button>
        </ChalkBox>
      </Reveal>
    </div>
  );
}
