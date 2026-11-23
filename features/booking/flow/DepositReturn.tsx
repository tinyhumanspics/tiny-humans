"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { site } from "@/config/site";
import { bundlesHref, scheduleHref } from "@/config/booking";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import { formatLongDate, formatTimeLabel } from "@/lib/booking";
import type { DepositReturnState } from "@/lib/deposit/types";
import { fill } from "@/lib/email/messages";
import { cn } from "@/lib/cn";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import Confirmation from "./Confirmation";
import OwnerBookedSteps from "./OwnerBookedSteps";
import PayDeposit from "./PayDeposit";
import styles from "./Booking.module.css";

const POLL_MS = 2500;
/** About a minute of "confirming…" before the calmer "your email will arrive shortly" text. */
const SLOW_AFTER = 24;
/** Back from Stripe's success page before Stripe's answer reached us: ask again a few times. */
const PAID_RETRIES = 6;


/**
 * The family's pay link and the page after its Stripe page (/book?bundle=…&deposit=<reference>&k=<signature>[&paid=1]):
 * the session and the Pay button while the time is held, then (paid) their home, ages and backdrops for a booking the
 * owner made, else the confirmation; or "this time is no longer held" after it was released.
 */
export default function DepositReturn({ bundleId, reference, signature, paid, locale, messages }: { bundleId: string; reference: string; signature: string; paid: boolean; locale: AppLocale; messages: typeof en.bookingFlow }) {
  const id = "book";
  const t = messages.depositReturn;
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<DepositReturnState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polls = useRef(0);
  const [slow, setSlow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/booking/deposit/status?${new URLSearchParams({ b: reference, k: signature })}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as DepositReturnState | null;
      if (!res.ok || !data?.state) throw new Error(t.error);
      setError(null);
      setState(data);
    } catch {
      setError(t.error);
    }
  }, [reference, signature, t.error]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads what is on screen (fine per react.dev)
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

  const startOver = () => {
    router.replace(scheduleHref(bundleId, undefined, locale));
  };

  const body = () => {
    if (!state) return <p className={cn(styles.confirmText, "chalk-soft")}>{error ?? t.checking}</p>;
    switch (state.state) {
      case "confirmed":
        // a booking the owner made for them: right after paying, their home, ages and backdrops (decision #22)
        if (state.link) return <OwnerBookedSteps link={state.link} reference={reference} signature={signature} messages={messages} headingRef={headingRef} />;
        return <Confirmation result={state.booking} headingRef={headingRef} onReset={() => router.push(bundlesHref(undefined, locale))} locale={locale} messages={messages} />;
      case "confirming":
        return (
          <div className={styles.confirm} role="status">
            <ChalkDoodle name="heart" size={84} color="var(--sun-yellow)" strokeWidth={3} className={styles.confirmHeart} />
            <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.confirmingTitle}</h2>
            <p className={cn(styles.confirmText, "chalk-soft")}>{slow ? t.confirmingSlow : t.confirmingText}</p>
          </div>
        );
      case "waiting":
        // the time is held: the $50 first (decision #22)
        return <PayDeposit state={state} reference={reference} signature={signature} locale={locale} messages={messages} headingRef={headingRef} />;
      case "expired":
        return (
          <div className={styles.confirm}>
            <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.expiredTitle}</h2>
            <p className={cn(styles.confirmText, "chalk-soft")}>{fill(t.expiredText, { date: formatLongDate(state.date, locale), time: formatTimeLabel(state.start, locale) })}</p>
            <ChalkButton variant="solid" onClick={startOver} seed={97}>{t.pickAgain}</ChalkButton>
          </div>
        );
      default:
        return (
          <div className={styles.confirm}>
            <h2 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>{t.invalidTitle}</h2>
            <p className={cn(styles.confirmText, "chalk-soft")}>{fill(t.invalidText, { email: site.contact.email ?? "" })}</p>
            <ChalkButton variant="solid" onClick={startOver} seed={97}>{t.pickAgain}</ChalkButton>
          </div>
        );
    }
  };

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        {/* the pay link's own title says it all; "Pick a day and time…" fits only picking a time */}
        <SectionHeading id={`${id}-title`} title={messages.section.title} subtitle={state?.state === "waiting" || (state?.state === "confirmed" && state.link) ? undefined : messages.section.subtitle} slot="book" level={1} />
        <div className={styles.panelAnchor} data-booking-panel>
          <ChalkBox className={styles.panel} seed={7} wobble={4} strokeWidth={3}>
            <div aria-live="polite">{body()}</div>
          </ChalkBox>
        </div>
      </div>
    </section>
  );
}
