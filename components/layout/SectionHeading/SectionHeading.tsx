"use client";

import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import BoardDoodles from "@/components/chalk/BoardDoodles/BoardDoodles";
import { useSiteSettings } from "@/components/providers/SiteSettingsProvider";
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
  /** Optional extra line under the subtitle (the special-offer line on the Bundles headings). */
  note?: React.ReactNode;
}

export default function SectionHeading({ id, title, subtitle, align = "start", slot, level = 2, note }: Props) {
  const Heading = level === 1 ? "h1" : "h2";
  const { theme, locale } = useSiteSettings();
  const doodle = theme.decorations.heading[slot];
  const spanish = locale === "es";
  // Long titles shrink a little on mid-size screens to stay on one line. They (and Spanish titles, which run longer)
  // leave out the desktop drawing 16% from the right, which would sit on their letters (seen with Linux fonts).
  const long = title.length > 28;
  // The last word and the doodle wrap together, so the doodle never ends up alone on a line.
  const words = title.split(" ");
  const lastWord = words.pop();
  return (
    <Reveal className={cn(styles.wrap, align === "center" && styles.center, long && styles.long)}>
      <BoardDoodles area="heading" desktopExtras={!spanish && !long} />
      <Heading id={id} className={cn(styles.title, "chalk")}>
        {words.length > 0 && `${words.join(" ")} `}
        <span className={styles.tail}>
          {lastWord}
          <ChalkDoodle grain={false} name={doodle} size={30} color={slot === "portfolio" ? "var(--accent-2)" : "var(--accent)"} className={styles.doodle} />
        </span>
      </Heading>
      <ChalkDoodle name="underline" size={170} color="var(--chalk-dim)" strokeWidth={2.4} className={styles.underline} />
      {subtitle && <p className={cn(styles.subtitle, "chalk-soft")}>{subtitle}</p>}
      {note}
    </Reveal>
  );
}
