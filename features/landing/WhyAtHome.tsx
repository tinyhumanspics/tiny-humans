"use client";

import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import Reveal from "@/components/layout/Reveal/Reveal";
import PinnedPhoto from "@/components/ui/PinnedPhoto/PinnedPhoto";
import { cn } from "@/lib/cn";
import en from "@/messages/en.json";
import { altOf } from "./HeroBits";
import styles from "./Landing.module.css";

/**
 * "The first weeks are for staying home." with its photo (/admin → Photos → "Why at home"; until one is picked, the About
 * Us "Behind the scenes" photo; nothing when neither exists). On the ad page and the home page.
 */
export default function WhyAtHome({ messages = en.landing.why, id }: { messages?: typeof en.landing.why; id: string }) {
  const { media } = useSiteSettings();
  const photo = media.landing[0];
  const [before, after] = messages.space.split("{strong}");
  return (
    <section className={cn("container", styles.section)} aria-labelledby={id}>
      <SectionHeading id={id} title={messages.title} slot="book" />
      <div className={cn(styles.why, !photo && styles.whySolo)}>
        <div>
          <p className={cn(styles.text, "chalk-soft")}>{messages.text}</p>
          <p className={cn(styles.text, "chalk-soft")}>
            {before}
            <b>{messages.spaceStrong}</b>
            {after}
          </p>
        </div>
        {photo && (
          <Reveal className={styles.whyPhoto}>
            <PinnedPhoto photo={{ ...photo, alt: altOf(photo, messages.photo) }} seed={45} sizes="(min-width: 900px) 520px, 100vw" showCaption={false} tape="white" />
          </Reveal>
        )}
      </div>
    </section>
  );
}
