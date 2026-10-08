"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/config/site";
import { bundlesHref, scheduleHref } from "@/config/booking";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { formatLongDate, formatTimeLabel } from "@/lib/booking";
import { forgetDepositReturn } from "@/lib/booking/deposit-return";
import type { DepositReturnState } from "@/lib/deposit/types";
import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";
import { trackBooked } from "@/lib/tracking/client";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import Confirmation from "./Confirmation";
import styles from "./Booking.module.css";

const t = en.deposit.return;
const POLL_MS = 2500;
/** About a minute of "confirming…" before the calmer "your email will arrive shortly" text. */
const SLOW_AFTER = 24;
/** Back from Stripe's success page before Stripe's answer reached us: ask again a few times. */
const PAID_RETRIES = 6;

const miamiClock = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(iso)).toLowerCase();

/**
 * The booking page after the deposit's Stripe page (/book?bundle=…&deposit=<reference>&k=<signature>[&paid=1]):
 * the confirmation once it's paid, "your date isn't confirmed yet" while the time is still held, or "this time is no
 * longer held" after it was released.
 */
export default function DepositReturn({ bundleId, reference, signature, paid }: { bundleId: string; reference: string; signature: string; paid: boolean }) {
  const { id, title, subtitle } = site.sections.book;
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<DepositReturnState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);
  const [slow, setSlow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/booking/deposit/status?${new URLSearchParams({ b: reference, k: signature })}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as (DepositReturnState & { error?: string }) | null;
      if (!res.ok || !data?.state) throw new Error(data?.error ?? t.error);
      setError(null);
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    }
  }, [reference, signature]);

  useEffect(() => {
    void load();
  }, [load]);

  // keep asking while it's being confirmed (or just paid and Stripe's answer is on its way)
  useEffect(() => {
    if (!state) return;
    const waitingAfterPay = state.state === "waiting" && paid && polls.current < PAID_RETRIES;
    if (state.state !== "confirming" && !waitingAfterPay) return;
    const timer = window.setTimeout(() => {
      polls.current += 1;
      if (polls.current >= SLOW_AFTER) setSlow(true);
      void load();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [state, paid, load]);

  useEffect(() => {
    if (!state || state.state === "waiting" || state.state === "confirming") return;
    forgetDepositReturn();
    if (state.state === "confirmed" && state.requestId) {
      const b = state.booking;
      trackBooked({
        eventId: state.requestId,
        id: b.request.bundleId,
        name: b.pricing?.bundleName ?? b.request.bundleId,
        value: ((b.pricing?.totalCents ?? b.pricing?.finalCents ?? 0) + (b.travel?.feeCents ?? 0)) / 100,
        contact: b.request.contact,
        address: b.request.address,
      });
    }
  }, [state]);

  const pickAnother = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/booking/deposit/release", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ b: reference, k: signature }) });
      const data = (await res.json().catch(() => null)) as (DepositReturnState & { error?: string }) | null;
      if (!res.ok || !data?.state) throw new Error(data?.error ?? t.error);
      if (data.state === "confirmed" || data.state === "confirming") return setState(data);
      startOver();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
      setBusy(false);
    }
  };
  const startOver = () => {
    forgetDepositReturn();
    router.replace(scheduleHref(bundleId));
  };

  const body = () => {
    if (!state) return <p className={cn(styles.confirmText, "chalk-soft")}>{error ?? t.checking}</p>;
    switch (state.state) {
      case "confirmed":
        return <Confirmation result={state.booking} headingRef={headingRef} onReset={() => router.push(bundlesHref())} />;
      case "confirming":
        return (
          <div className={styles.confirm} role="status">
            <ChalkDoodle name="heart" size={84} color="var(--sun-yellow)" strokeWidth={3} className={styles.confirmHeart} />
            <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.confirmingTitle}</h3>
            <p className={cn(styles.confirmText, "chalk-soft")}>{slow ? t.confirmingSlow : t.confirmingText}</p>
          </div>
        );
      case "waiting": {
        const when = { date: formatLongDate(state.date), time: formatTimeLabel(state.start) };
        const deposit = formatMoney(state.amountCents);
        return (
          <div className={styles.confirm}>
            <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.waitingTitle}</h3>
            <p className={cn(styles.confirmText, "chalk-soft")}>
              {state.payUrl && state.holdUntil ? fill(t.waitingText, { ...when, until: miamiClock(state.holdUntil), deposit }) : fill(t.waitingClosed, when)}
            </p>
            <div className={styles.depositActions}>
              {state.payUrl && (
                <ChalkButton href={state.payUrl} variant="solid" seed={95}>
                  {fill(t.pay, { deposit })}
                </ChalkButton>
              )}
              <ChalkButton variant="outline" onClick={pickAnother} disabled={busy} seed={96}>
                {busy ? t.releasing : t.another}
              </ChalkButton>
            </div>
            {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
          </div>
        );
      }
      case "expired":
        return (
          <div className={styles.confirm}>
            <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.expiredTitle}</h3>
            <p className={cn(styles.confirmText, "chalk-soft")}>{fill(t.expiredText, { date: formatLongDate(state.date), time: formatTimeLabel(state.start) })}</p>
            <ChalkButton variant="solid" onClick={startOver} seed={97}>{t.pickAgain}</ChalkButton>
          </div>
        );
      default:
        return (
          <div className={styles.confirm}>
            <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.invalidTitle}</h3>
            <p className={cn(styles.confirmText, "chalk-soft")}>{fill(t.invalidText, { email: site.contact.email ?? "" })}</p>
            <ChalkButton variant="solid" onClick={startOver} seed={97}>{t.pickAgain}</ChalkButton>
          </div>
        );
    }
  };

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={title} subtitle={subtitle} slot="book" />
        <div className={styles.panelAnchor} data-booking-panel>
          <ChalkBox className={styles.panel} seed={7} wobble={4} strokeWidth={3}>
            <div aria-live="polite">{body()}</div>
          </ChalkBox>
        </div>
      </div>
    </section>
  );
}
