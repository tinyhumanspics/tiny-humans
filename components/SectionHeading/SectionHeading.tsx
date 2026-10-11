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
  /** 1 when this heading is the page's main heading (screen readers jump to it). */
  level?: 1 | 2;
}

export default function SectionHeading({ id, title, subtitle, align = "start", slot, level = 2 }: Props) {
  const Heading = level === 1 ? "h1" : "h2";
  const { theme, locale } = useSiteSettings();
  const doodle = theme.decorations.heading[slot];
  // Spanish titles run longer: the mid-heading desktop drawing would sit on their letters.
  const spanish = locale === "es";
  // Long titles (today only Spanish ones) shrink a little on mid-size screens to stay on one line.
  const long = title.length > 30;
  // The last word and the doodle wrap together, so the doodle never ends up alone on a line.
  const words = title.split(" ");
  const lastWord = words.pop();
  return (
    <Reveal className={cn(styles.wrap, align === "center" && styles.center, long && styles.long)}>
      <BoardDoodles area="heading" desktopExtras={!spanish} />
      <Heading id={id} className={cn(styles.title, "chalk")}>
        {words.length > 0 && `${words.join(" ")} `}
        <span className={styles.tail}>
          {lastWord}
          <ChalkDoodle grain={false} name={doodle} size={30} color={slot === "portfolio" ? "var(--accent-2)" : "var(--accent)"} className={styles.doodle} />
        </span>
      </Heading>
      <ChalkDoodle name="underline" size={170} color="var(--chalk-dim)" strokeWidth={2.4} className={styles.underline} />
      {subtitle && <p className={cn(styles.subtitle, "chalk-soft")}>{subtitle}</p>}
    </Reveal>
  );
}
