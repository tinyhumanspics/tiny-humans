import type { Metadata } from "next";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { bundlesHref } from "@/config/booking";
import { cn } from "@/lib/cn";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { getSpanishPublication } from "@/i18n/publication";
import styles from "../not-found.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = (await getSpanishPublication()).published ? es : en;
  return { title: messages.errors.notFound.metaTitle, robots: { index: false, follow: false } };
}

export default async function NotFound() {
  const published = (await getSpanishPublication()).published;
  const t = (published ? es : en).errors.notFound;
  const locale = published ? "es" : "en";
  return (
    <main id="top" className={cn("container", styles.page)}>
      <div className={styles.doodles} aria-hidden="true">
        <ChalkDoodle name="cloud" size={64} color="var(--cloud-blue)" strokeWidth={3} />
        <ChalkDoodle name="star" size={30} color="var(--sun-yellow)" strokeWidth={3} className={styles.star} />
      </div>
      <ChalkBox className={styles.box} seed={404} wobble={3} strokeWidth={2.6}>
        <p className={cn(styles.code, "chalk")} aria-hidden="true">404</p>
        <h1 className={cn(styles.title, "chalk")}>{t.title}</h1>
        <p className={cn(styles.body, "chalk-soft")}>{t.body}</p>
        <div className={styles.actions}>
          <ChalkButton href={published ? "/es" : "/"} variant="solid" seed={405}>{t.home}</ChalkButton>
          <ChalkButton href={bundlesHref(null, locale)} variant="outline" seed={406}>{t.bundles}</ChalkButton>
        </div>
      </ChalkBox>
    </main>
  );
}
