import type { Metadata } from "next";
import en from "@/messages/en.json";
import { bundlesHref } from "@/config/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./not-found.module.css";
import { cn } from "@/lib/cn";

const t = en.errors.notFound;

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

/** 404: any unknown address (Next adds `noindex` automatically). Rendered inside the root layout (header + footer). */
export default function NotFound() {
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
          <ChalkButton href="/" variant="solid" seed={405}>
            {t.home}
          </ChalkButton>
          <ChalkButton href={bundlesHref()} variant="outline" seed={406}>
            {t.bundles}
          </ChalkButton>
        </div>
      </ChalkBox>
    </main>
  );
}
