"use client";

import { useState, type RefObject } from "react";
import { site } from "@/config/site";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import BackdropPicker from "@/features/booking/backdrops/BackdropPicker";
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
 * A family's link for a session the owner booked for them (/admin → Quotes / Booking, owner Nov 12): 1) pick their
 * backdrops (as many as the bundle's setups, or "not sure yet"), 2) pay the deposit on Stripe, which confirms it.
 */
export default function OwnerBookedSteps({ state, reference, signature, locale, messages, headingRef }: { state: Waiting; reference: string; signature: string; locale: AppLocale; messages: typeof en.bookingFlow; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = messages.depositReturn;
  const names = messages.details.backdrops.names as Record<string, string>;
  const allowed = state.backdrops?.allowed ?? 1;
  const savedAtStart = state.backdrops?.picks ?? [];
  const [picks, setPicks] = useState<string[]>(savedAtStart);
  // null = still choosing; [] = "not sure yet"; else what was saved
  const [saved, setSaved] = useState<string[] | null>(savedAtStart.length ? savedAtStart : null);
  const [busy, setBusy] = useState<"save" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deposit = formatMoney(state.amountCents);
  const intro = fill(t.bookedText, {
    bundle: state.bundleName,
    date: formatLongDate(state.date, locale),
    time: formatTimeLabel(state.start, locale),
    deposit,
    until: state.holdUntil ? miamiDateTime(state.holdUntil, locale) : "",
  });

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ b: reference, k: signature, ...body }) });
    const data = (await res.json().catch(() => null)) as { error?: string; picks?: string[]; url?: string } | null;
    if (!res.ok || !data) throw new Error(data?.error || t.error);
    return data;
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      setSaved((await post("/api/booking/deposit/backdrops", { picks })).picks ?? picks);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    setBusy("pay");
    setError(null);
    try {
      const url = state.payUrl ?? (await post("/api/booking/deposit/pay", {})).url;
      if (!url) throw new Error(t.error);
      window.location.assign(url);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className={styles.confirm}>
      <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.bookedTitle}</h2>
      <p className={cn(styles.confirmText, "chalk-soft")}>{intro}</p>

      <div className={styles.ownerStep}>
        <h3 className={cn(styles.ownerStepTitle, "chalk")}>{allowed > 1 ? t.stepBackdrops : t.stepBackdrop}</h3>
        {saved === null ? (
          <>
            <BackdropPicker max={allowed} value={picks} onChange={setPicks} label={allowed > 1 ? messages.details.backdrops.titleMany : messages.details.backdrops.title} names={names} />
            <div className={styles.depositActions}>
              <ChalkButton variant="solid" onClick={save} disabled={busy !== null || !picks.length} seed={101}>
                {busy === "save" ? t.savingBackdrops : t.saveBackdrops}
              </ChalkButton>
              <ChalkButton variant="outline" onClick={() => (setSaved([]), setError(null))} disabled={busy !== null} seed={102}>
                {t.skipBackdrops}
              </ChalkButton>
            </div>
          </>
        ) : (
          <p className={cn(styles.confirmText, "chalk-soft")}>
            {saved.length ? fill(t.backdropsSaved, { list: saved.map((id) => names[id] ?? id).join(", ") }) : t.backdropsLater}{" "}
            <button type="button" className={styles.ownerStepChange} onClick={() => setSaved(null)}>
              {t.changeBackdrops}
            </button>
          </p>
        )}
      </div>

      <div className={styles.ownerStep}>
        <h3 className={cn(styles.ownerStepTitle, "chalk")}>{fill(t.stepPay, { deposit })}</h3>
        <ChalkButton variant="solid" onClick={pay} disabled={busy !== null || saved === null} seed={103}>
          {busy === "pay" ? t.opening : fill(t.pay, { deposit })}
        </ChalkButton>
        <p className={cn(styles.ownerStepNote, "chalk-soft")}>{t.payNote}</p>
      </div>

      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      <p className={cn(styles.ownerStepNote, "chalk-soft")}>{fill(t.otherTime, { phone: site.contact.phone })}</p>
    </div>
  );
}
