"use client";

import { useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import { bundlesHref } from "@/config/booking";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import PinnedPhoto from "@/components/PinnedPhoto/PinnedPhoto";
import Reveal from "@/components/Reveal/Reveal";
import BoardDoodles from "@/components/BoardDoodles/BoardDoodles";
import styles from "./Hero.module.css";
import { cn } from "@/lib/cn";

export default function Hero({ messages = en.home.hero, locale = "en" }: { messages?: typeof en.home.hero; locale?: AppLocale }) {
  const hero = messages;
  const { media, theme } = useSiteSettings();
  const [first, second] = media.title;
  const [doodleA, doodleB] = theme.decorations.hero;
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cn("container", styles.grid)}>
        <Reveal className={styles.copy}>
          <BoardDoodles area="hero" />
          <h1 id="hero-title" className={cn(styles.title, "chalk")}>
            {hero.title.map((line) => (
              <span key={line} className={styles.line}>{line}</span>
            ))}
          </h1>
          <ChalkDoodle name="underline" size={230} color="var(--sun-yellow)" strokeWidth={3} className={styles.underline} />
          <p className={cn(styles.subtitle, "chalk-soft")}>{hero.subtitle}</p>
          <p className={cn(styles.promise, "chalk-soft")}>
            <ChalkDoodle name="house" size={30} color="var(--accent)" strokeWidth={3} className={styles.promiseIcon} />
            <span>{hero.promise}</span>
          </p>
          <div className={styles.actions}>
            <ChalkButton href={localePath("/#portfolio", locale)} variant="outline" seed={11}>{hero.secondaryCta}</ChalkButton>
            <ChalkButton href={bundlesHref(undefined, locale)} variant="solid" seed={12}>{hero.primaryCta}</ChalkButton>
          </div>
        </Reveal>
        <Reveal className={styles.snaps} delay={250}>
          <div aria-hidden="true" className={styles.snapsInner}>
          <div className={styles.snapA}>
            <PinnedPhoto photo={first} seed={21} sizes="(min-width: 900px) 300px, 46vw" priority showCaption={false} tape="yellow" />
          </div>
          <div className={styles.snapB}>
            <PinnedPhoto photo={second} seed={22} sizes="(min-width: 900px) 320px, 50vw" priority showCaption={false} tape="blue" />
          </div>
          <ChalkDoodle name={doodleA} size={40} color="var(--accent-2)" className={styles.heart} />
          <ChalkDoodle name={doodleB} size={34} color="var(--accent)" className={styles.sparkle} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
