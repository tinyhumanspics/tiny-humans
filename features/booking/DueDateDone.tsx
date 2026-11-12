import type en from "@/messages/en.json";
import { site } from "@/config/site";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import styles from "./due/DueDate.module.css";
import { DuePayButton, ForgetDueReturn } from "./DuePayButton";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/**
 * After reserving with the due date (or coming back from the deposit's Stripe page): reserved, or not paid yet with
 * "Pay the deposit" (owner, Nov 11: the open payment page, else a fresh one for their saved reservation), or not valid.
 */
export default function DueDateDone({ state, name, payUrl, paid, againHref, bundlesHref, messages, r, k, locale }: { state: "reserved" | "pending" | "expired" | "invalid"; name?: string; payUrl?: string; paid: boolean; againHref: string; bundlesHref: string; messages: typeof en.dueDate.done; r: string; k: string; locale: "en" | "es" }) {
  const t = messages;
  const content =
    state === "reserved"
      ? { title: t.title, text: fill(t.body, { name: name?.split(" ")[0] ?? "", phone: site.contact.phone }) }
      : state === "pending"
        ? { title: t.pendingTitle, text: paid && !payUrl ? t.checking : t.pendingBody }
        : state === "expired"
          ? { title: t.expiredTitle, text: t.expiredBody }
          : { title: t.invalidTitle, text: t.invalid };
  return (
    <section className={styles.section}>
      <div className="container">
        <ChalkBox className={styles.done} seed={83} wobble={2.4} strokeWidth={2.4} color={state === "reserved" ? "var(--sun-yellow)" : "var(--chalk-white)"}>
          <h1 className={cn(styles.doneTitle, "chalk")}>{content.title}</h1>
          <p className={cn(styles.doneText, "chalk-soft")} role={state === "reserved" ? "status" : undefined}>{content.text}</p>
          {state === "pending" && payUrl && <ChalkButton variant="solid" href={payUrl} seed={84}>{t.pay}</ChalkButton>}
          {((state === "pending" && !payUrl && !paid) || state === "expired") && <DuePayButton r={r} k={k} locale={locale} label={t.pay} paying={t.paying} failed={t.payError} />}
          {state === "invalid" && <ChalkButton variant="solid" href={againHref} seed={85}>{t.again}</ChalkButton>}
          {(state === "reserved" || state === "invalid") && <ForgetDueReturn />}
          <ChalkButton variant="outline" href={bundlesHref} seed={86}>{t.bundles}</ChalkButton>
        </ChalkBox>
      </div>
    </section>
  );
}
