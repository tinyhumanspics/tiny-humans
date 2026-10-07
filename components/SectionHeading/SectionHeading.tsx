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
  /** Which section: picks the theme's doodle for it. */
  slot: "portfolio" | "bundles" | "book";
}

export default function SectionHeading({ id, title, subtitle, slot }: Props) {
  const { theme } = useSiteSettings();
  const doodle = theme.decorations.heading[slot];
  return (
    <Reveal className={styles.wrap}>
      <BoardDoodles area="heading" />
      <h2 id={id} className={cn(styles.title, "chalk")}>
        {title}
        <ChalkDoodle grain={false} name={doodle} size={30} color={slot === "portfolio" ? "var(--accent-2)" : "var(--accent)"} className={styles.doodle} />
      </h2>
      <ChalkDoodle name="underline" size={170} color="var(--chalk-dim)" strokeWidth={2.4} className={styles.underline} />
      {subtitle && <p className={cn(styles.subtitle, "chalk-soft")}>{subtitle}</p>}
    </Reveal>
  );
}
