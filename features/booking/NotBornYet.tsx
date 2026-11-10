"use client";

import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import type en from "@/messages/en.json";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import Reveal from "@/components/layout/Reveal/Reveal";
import { useCatalog } from "@/components/providers/CatalogProvider";
import styles from "./NotBornYet.module.css";
import { cn } from "@/lib/cn";

/** "Not born yet?" under the bundle cards (/bundles and the ad landing page): book with the due date instead of a day. */
export default function NotBornYet({ messages, locale, headingLevel = 2 }: { messages: typeof en.dueDate.invite; locale: AppLocale; headingLevel?: 2 | 3 }) {
  const Title = headingLevel === 3 ? "h3" : "h2";
  const { available } = useCatalog();
  if (!available) return null;
  return (
    <Reveal className={styles.wrap}>
      <ChalkBox className={styles.box} seed={71} wobble={2.6} strokeWidth={2.6} color="var(--cloud-blue)">
        <ChalkDoodle name="heart" size={30} color="var(--accent)" className={styles.doodle} />
        <Title className={cn(styles.title, "chalk")}>{messages.title}</Title>
        <p className={cn(styles.text, "chalk-soft")}>{messages.text}</p>
        <ChalkButton variant="outline" href={localePath("/due-date", locale)} seed={72} className={styles.button}>
          {messages.button}
        </ChalkButton>
      </ChalkBox>
    </Reveal>
  );
}

/**
 * The short version near the top of the home page and the ad page, under the seasonal offer boxes (owner, Nov 10:
 * "so they can also see it at the top"): one line and the button, on every page load (not tied to an offer).
 */
export function NotBornYetStrip({ messages, locale }: { messages: typeof en.dueDate.invite; locale: AppLocale }) {
  const { available } = useCatalog();
  if (!available) return null;
  return (
    <section className={cn("container", styles.stripSection)} aria-labelledby="not-born-yet-top">
      <Reveal>
        <ChalkBox className={styles.strip} seed={73} wobble={2.2} strokeWidth={2.4} color="var(--cloud-blue)">
          <ChalkDoodle name="heart" size={34} color="var(--accent)" className={styles.stripDoodle} />
          <div className={styles.stripText}>
            <h2 id="not-born-yet-top" className={cn(styles.stripTitle, "chalk")}>{messages.title}</h2>
            <p className={cn(styles.text, "chalk-soft")}>{messages.text}</p>
          </div>
          <ChalkButton variant="outline" href={localePath("/due-date", locale)} seed={74}>
            {messages.button}
          </ChalkButton>
        </ChalkBox>
      </Reveal>
    </section>
  );
}
