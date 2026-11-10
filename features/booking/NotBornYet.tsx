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
