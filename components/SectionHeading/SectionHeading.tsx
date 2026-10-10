"use client";

import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/Reveal/Reveal";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import styles from "./SectionHeading.module.css";
import { cn } from "@/lib/cn";

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  /** Which section: picks the theme's doodle for it. */
  slot: "portfolio" | "bundles" | "book";
}

export default function SectionHeading({ id, title, subtitle, align = "start", slot }: Props) {
  const { theme, locale } = useSiteSettings();
  const doodle = theme.decorations.heading[slot];
  // Spanish titles run longer: the mid-heading desktop drawing would sit on their letters.
  const spanish = locale === "es";
  // Long titles (today only Spanish ones) shrink a little on mid-size screens to stay on one line.
  const long = title.length > 30;
  return (
    <Reveal className={cn(styles.wrap, align === "center" && styles.center, spanish && styles.es, long && styles.long)}>
      <BoardDoodles area="heading" desktopExtras={!spanish} />
      <h2 id={id} className={cn(styles.title, "chalk")}>
        {title}
        <ChalkDoodle grain={false} name={doodle} size={30} color={slot === "portfolio" ? "var(--accent-2)" : "var(--accent)"} className={styles.doodle} />
      </h2>
      <ChalkDoodle name="underline" size={170} color="var(--chalk-dim)" strokeWidth={2.4} className={styles.underline} />
      {subtitle && <p className={cn(styles.subtitle, "chalk-soft")}>{subtitle}</p>}
    </Reveal>
  );
}
