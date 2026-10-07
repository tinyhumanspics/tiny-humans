"use client";

import { portfolioCtaLabel, type PortfolioPhoto } from "@/config/portfolio";
import { bundlesHref } from "@/config/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/Reveal/Reveal";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import InspirationThumb from "@/components/Booking/InspirationThumb";
import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import styles from "./PortfolioCta.module.css";
import { cn } from "@/lib/cn";

interface Props {
  photo: PortfolioPhoto;
  title: string;
  text: string;
  seed: number;
  flip?: boolean;
}

/** "Book a memory like this one" prompt between portfolio groups. */
export default function PortfolioCta({ photo, title, text, seed, flip }: Props) {
  const { theme } = useSiteSettings();
  return (
    <Reveal className={styles.wrap}>
      <BoardDoodles area="cta" />
      <ChalkBox className={cn(styles.box, flip ? styles.flip : "")} seed={seed} wobble={3} strokeWidth={2.6} color="var(--sun-yellow)">
        <InspirationThumb photo={photo} size={96} />
        <div className={cn(styles.text, "chalk")}>
          <p className={styles.title}>{title}</p>
          <p className={styles.sub}>{text}</p>
        </div>
        <ChalkButton href={bundlesHref(photo.id)} variant="solid" seed={seed + 3} className={styles.button}>
          {portfolioCtaLabel}
        </ChalkButton>
        <ChalkDoodle name={theme.decorations.cta[flip ? 1 : 0]} size={32} color="var(--accent-2)" className={styles.doodle} />
      </ChalkBox>
    </Reveal>
  );
}
