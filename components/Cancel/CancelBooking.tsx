"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { formatLongDate, formatTimeLabel, getBookingClient, BookingApiError, type CancellationSummary } from "@/lib/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./CancelBooking.module.css";
import { site } from "@/config/site";
import { cancelClosedText } from "@/lib/booking/reschedule-policy";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/email/messages";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import { useCatalog } from "@/components/Catalog/CatalogProvider";

type View = "loading" | "invalid" | "form" | "done" | "already" | "past" | "closed";

/** Shows the booking behind a cancel link and cancels only after an explicit confirmation with a reason. */
export default function CancelBooking({ locale = "en", messages = en.cancelPage, policyMessages = en.policy }: { locale?: AppLocale; messages?: typeof en.cancelPage; policyMessages?: typeof en.policy }) {
  const token = useSearchParams().get("t") ?? "";
  const { getBundle } = useCatalog();
  const [view, setView] = useState<View>("loading");
  const [booking, setBooking] = useState<CancellationSummary | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setView("invalid");
      return;
    }
    getBookingClient()
      .getCancellation(token)
      .then((b) => {
        setBooking(b);
        setView(b.status === "cancelled" ? "already" : b.status === "past" ? "past" : b.canCancel ? "form" : "closed");
      })
      .catch((e) => {
        setMessage(e instanceof BookingApiError && e.code === "network" ? messages.errors.network : e instanceof BookingApiError && e.code === "rate_limited" ? messages.errors.rateLimited : messages.invalid);
        setView("invalid");
      });
  }, [token, messages]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError(messages.reasonError);
      document.getElementById("cancel-reason")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setBooking(await getBookingClient().cancelWithToken(token, reason.trim()));
      setView("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof BookingApiError && err.code === "cancel_closed") {
        setBooking((current) => (current ? { ...current, canCancel: false } : current));
        setView("closed");
      } else {
        setError(err instanceof BookingApiError && err.code === "network" ? messages.errors.network : err instanceof BookingApiError && err.code === "rate_limited" ? messages.errors.rateLimited : messages.errors.submit);
      }
    } finally {
      setBusy(false);
    }
  };

  const bundleName = booking ? getBundle(booking.bundleId)?.name ?? booking.bundleName : "";
  const info = booking && (
    <dl className={styles.details}>
      <div><dt className="chalk-soft">{messages.labels.reference}</dt><dd className="chalk-soft">{booking.reference}</dd></div>
      <div><dt className="chalk-soft">{messages.labels.bundle}</dt><dd className="chalk-soft">{bundleName}</dd></div>
      <div><dt className="chalk-soft">{messages.labels.date}</dt><dd className="chalk-soft">{formatLongDate(booking.date, locale)}</dd></div>
      <div><dt className="chalk-soft">{messages.labels.time}</dt><dd className="chalk-soft">{fill(messages.timeRange, { start: formatTimeLabel(booking.start, locale), end: formatTimeLabel(booking.end, locale) })}</dd></div>
    </dl>
  );

  return (
    <section className={cn("container", styles.page)} aria-labelledby="cancel-title">
      <ChalkBox className={styles.panel} seed={311} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={cn(styles.muted, "chalk-soft")}>{messages.loading}</p>}

        {view === "invalid" && (
          <>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>{messages.invalidTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{message || messages.invalid}</p>
            <p className={cn(styles.text, "chalk-soft")}>{fill(messages.help, { email: site.contact.email ?? "" })}</p>
            <ChalkButton href={localePath("/", locale)} variant="outline" seed={312}>{messages.home}</ChalkButton>
          </>
        )}

        {(view === "already" || view === "past") && (
          <>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>{view === "already" ? messages.alreadyTitle : messages.pastTitle}</h1>
            {info}
            <p className={cn(styles.text, "chalk-soft")}>
              {view === "already" ? messages.alreadyText : messages.pastText}
            </p>
            <ChalkButton href={localePath("/bundles", locale)} variant="solid" seed={313}>{messages.book}</ChalkButton>
          </>
        )}

        {view === "closed" && booking && (
          <>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{fill(messages.greeting, { name: booking.parentFirstName })}</p>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>{policyMessages.closedCancelTitle}</h1>
            {info}
            <p className={cn(styles.text, "chalk-soft")}>{cancelClosedText(booking.noticeHours, policyMessages)}</p>
            <div className={styles.actions}>
              <Link href={localePath("/", locale)} className={cn(styles.link, "chalk-soft")}>{messages.home}</Link>
              <ChalkButton href={`sms:${site.contact.sms}`} variant="solid" seed={317}>{fill(policyMessages.textUs, { phone: site.contact.phone })}</ChalkButton>
            </div>
          </>
        )}

        {view === "form" && booking && (
          <form onSubmit={submit} noValidate>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{fill(messages.greeting, { name: booking.parentFirstName })}</p>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>{messages.title}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{messages.intro}</p>
            {info}
            <label htmlFor="cancel-reason" className={cn(styles.label, "chalk-soft")}>{messages.reasonLabel}</label>
            <textarea
              id="cancel-reason"
              className={styles.textarea}
              rows={4}
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              placeholder={messages.reasonPlaceholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "cancel-error" : undefined}
            />
            {error && <p id="cancel-error" className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
            <div className={styles.actions}>
              <ChalkButton href={localePath("/", locale)} variant="outline" seed={314}>{messages.keep}</ChalkButton>
              <ChalkButton type="submit" variant="solid" disabled={busy} seed={315}>{busy ? messages.cancelling : messages.confirm}</ChalkButton>
            </div>
          </form>
        )}

        {view === "done" && booking && (
          <div className={styles.done} role="status">
            <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />
            <p className={cn(styles.eyebrow, "chalk-soft")}>{messages.doneEyebrow}</p>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")} tabIndex={-1}>{messages.doneTitle}</h1>
            {info}
            <p className={cn(styles.text, "chalk-soft")}>{messages.doneText}</p>
            <div className={styles.actions}>
              <Link href={localePath("/", locale)} className={cn(styles.link, "chalk-soft")}>{messages.home}</Link>
              <ChalkButton href={localePath("/bundles", locale)} variant="solid" seed={316}>{messages.bookAnother}</ChalkButton>
            </div>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
