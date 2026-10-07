import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import styles from "./AfterSession.module.css";

export type PayState = keyof Omit<typeof en.pay, "metaTitle" | "home">;
export const PAY_STATES = ["paid", "already", "nothing", "cancelled", "invalid", "error"] as const satisfies readonly PayState[];

/** Where the family lands after the Stripe payment page (or when a pay link can't be used). */
export default function PayStatus({ state }: { state: PayState }) {
  const m = en.pay[state];
  const good = state === "paid" || state === "already" || state === "nothing";
  return (
    <section className={cn("container", styles.page)} aria-labelledby="pay-title">
      <ChalkBox className={styles.panel} seed={411} wobble={3.4} strokeWidth={2.8}>
        <div className={styles.done} role="status">
          {good && <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />}
          <h1 id="pay-title" className={cn(styles.title, "chalk")}>{m.title}</h1>
          <p className={cn(styles.text, "chalk-soft")}>{m.text}</p>
          <div className={styles.actions}>
            <ChalkButton href="/" variant="outline" seed={412}>{en.pay.home}</ChalkButton>
          </div>
        </div>
      </ChalkBox>
    </section>
  );
}
