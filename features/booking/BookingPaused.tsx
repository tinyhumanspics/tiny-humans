"use client";

import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { site } from "@/config/site";
import en from "@/messages/en.json";
import shared from "@/components/Booking/Booking.module.css";
import styles from "./BookingPaused.module.css";
import { cn } from "@/lib/cn";

/** Shown instead of bundles/booking when prices can't be loaded (never shows stale hardcoded prices). */
export default function BookingPaused({ messages = en.bundlesPage.paused }: { messages?: typeof en.bundlesPage.paused }) {
  const t = messages;
  const email = site.contact.email;
  return (
    <div className={styles.wrap} role="status">
      <ChalkBox className={styles.box} seed={79} wobble={3} strokeWidth={2.6}>
        <h2 className={cn(shared.stepTitle, "chalk")}>{t.title}</h2>
        <p className="chalk-soft">{t.body}</p>
        <div className={styles.actions}>
          <ChalkButton variant="solid" seed={80} onClick={() => window.location.reload()}>
            {t.retry}
          </ChalkButton>
          {email && (
            <ChalkButton variant="outline" seed={81} href={`mailto:${email}`}>
              {t.emailLabel}
            </ChalkButton>
          )}
        </div>
      </ChalkBox>
    </div>
  );
}
