import type en from "@/messages/en.json";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./NotFound.module.css";
import { cn } from "@/lib/cn";

/** The chalkboard 404 (English and Spanish 404 pages). */
export default function NotFound({ messages: t, homeHref, bundlesHref }: { messages: typeof en.errors.notFound; homeHref: string; bundlesHref: string }) {
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
          <ChalkButton href={homeHref} variant="solid" seed={405}>{t.home}</ChalkButton>
          <ChalkButton href={bundlesHref} variant="outline" seed={406}>{t.bundles}</ChalkButton>
        </div>
      </ChalkBox>
    </main>
  );
}
