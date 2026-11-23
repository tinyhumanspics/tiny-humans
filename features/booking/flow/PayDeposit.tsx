"use client";

import { useState, type FormEvent, type RefObject } from "react";
import { site } from "@/config/site";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { formatLongDate, formatTimeLabel } from "@/lib/booking";
import type { DepositReturnState } from "@/lib/deposit/types";
import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import styles from "./Booking.module.css";

type Waiting = Extract<DepositReturnState, { state: "waiting" }>;

const miamiDateTime = (iso: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * A family's link while their time is held (decision #22: the $50 first): the session, its total with travel and the
 * refund rule above the Pay button, which opens Stripe. Their home, ages and backdrops come after, on the same page.
 */
export default function PayDeposit({ state, reference, signature, locale, messages, headingRef }: { state: Waiting; reference: string; signature: string; locale: AppLocale; messages: typeof en.bookingFlow; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = messages.depositReturn;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deposit = formatMoney(state.amountCents);

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let url = state.payUrl;
      if (!url) {
        const res = await fetch("/api/booking/deposit/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ b: reference, k: signature }) });
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) throw new Error(data?.error || t.error);
        url = data.url;
      }
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className={styles.confirm} noValidate onSubmit={pay}>
      <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{fill(t.holdTitle, { name: state.name })}</h2>
      <p className={cn(styles.confirmText, "chalk-soft")}>
        {fill(t.holdText, {
          bundle: state.bundleName,
          date: formatLongDate(state.date, locale),
          time: formatTimeLabel(state.start, locale),
          total: formatMoney(state.totalCents),
          deposit,
          until: state.holdUntil ? miamiDateTime(state.holdUntil, locale) : "",
        })}
      </p>
      <p className={cn(styles.ownerStepNote, "chalk-soft")}>{fill(t.refund, { hours: String(state.noticeHours) })}</p>
      <div className={styles.depositActions}>
        <ChalkButton variant="solid" type="submit" disabled={busy} seed={103}>
          {busy ? t.opening : fill(t.payNow, { deposit })}
        </ChalkButton>
      </div>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      <p className={cn(styles.ownerStepNote, "chalk-soft")}>{fill(t.otherTime, { phone: site.contact.phone })}</p>
    </form>
  );
}
