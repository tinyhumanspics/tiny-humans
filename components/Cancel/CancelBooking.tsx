"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { formatLongDate, formatTimeLabel, getBookingClient, BookingApiError, type CancellationSummary } from "@/lib/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./CancelBooking.module.css";
import { cn } from "@/lib/cn";

type View = "loading" | "invalid" | "form" | "done" | "already" | "past";

/** Shows the booking behind a cancel link and cancels only after an explicit confirmation with a reason. */
export default function CancelBooking() {
  const token = useSearchParams().get("t") ?? "";
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
        setView(b.status === "cancelled" ? "already" : b.status === "past" ? "past" : "form");
      })
      .catch((e) => {
        setMessage(e instanceof BookingApiError || e instanceof Error ? e.message : "This cancellation link isn't valid.");
        setView("invalid");
      });
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Please tell us why you need to cancel.");
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
      setError(err instanceof Error ? err.message : "We couldn't cancel just now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const info = booking && (
    <dl className={styles.details}>
      <div><dt className="chalk-soft">Booking reference</dt><dd className="chalk-soft">{booking.reference}</dd></div>
      <div><dt className="chalk-soft">Bundle</dt><dd className="chalk-soft">{booking.bundleName}</dd></div>
      <div><dt className="chalk-soft">Date</dt><dd className="chalk-soft">{formatLongDate(booking.date)}</dd></div>
      <div><dt className="chalk-soft">Time</dt><dd className="chalk-soft">{formatTimeLabel(booking.start)} to {formatTimeLabel(booking.end)}</dd></div>
    </dl>
  );

  return (
    <section className={cn("container", styles.page)} aria-labelledby="cancel-title">
      <ChalkBox className={styles.panel} seed={311} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={cn(styles.muted, "chalk-soft")}>Finding your booking…</p>}

        {view === "invalid" && (
          <>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>We couldn&apos;t open this link</h1>
            <p className={cn(styles.text, "chalk-soft")}>{message || "This cancellation link isn't valid."}</p>
            <p className={cn(styles.text, "chalk-soft")}>Reply to your confirmation email, or write to hello@tinyhumans.photography, and we&apos;ll help.</p>
            <ChalkButton href="/" variant="outline" seed={312}>Back to Tiny Humans</ChalkButton>
          </>
        )}

        {(view === "already" || view === "past") && (
          <>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>{view === "already" ? "This session is already cancelled" : "This session has already started"}</h1>
            {info}
            <p className={cn(styles.text, "chalk-soft")}>
              {view === "already" ? "Nothing else to do. If you'd like to book another session, we'd love to see you." : "It can't be cancelled online anymore. Please reply to your confirmation email."}
            </p>
            <ChalkButton href="/bundles" variant="solid" seed={313}>Book a session</ChalkButton>
          </>
        )}

        {view === "form" && booking && (
          <form onSubmit={submit} noValidate>
            <p className={cn(styles.eyebrow, "chalk-soft")}>Hi {booking.parentFirstName}</p>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")}>Cancel your session?</h1>
            <p className={cn(styles.text, "chalk-soft")}>Here&apos;s the session you&apos;re about to cancel:</p>
            {info}
            <label htmlFor="cancel-reason" className={cn(styles.label, "chalk-soft")}>Reason for cancellation</label>
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
              placeholder="Please let us know why you need to cancel your session."
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "cancel-error" : undefined}
            />
            {error && <p id="cancel-error" className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
            <div className={styles.actions}>
              <ChalkButton href="/" variant="outline" seed={314}>Keep My Booking</ChalkButton>
              <ChalkButton type="submit" variant="solid" disabled={busy} seed={315}>{busy ? "Cancelling…" : "Confirm Cancellation"}</ChalkButton>
            </div>
          </form>
        )}

        {view === "done" && booking && (
          <div className={styles.done} role="status">
            <ChalkDoodle name="heart" size={64} color="var(--cloud-blue)" strokeWidth={3} />
            <p className={cn(styles.eyebrow, "chalk-soft")}>Booking cancelled</p>
            <h1 id="cancel-title" className={cn(styles.title, "chalk")} tabIndex={-1}>Your session has been cancelled</h1>
            {info}
            <p className={cn(styles.text, "chalk-soft")}>
              We&apos;re sorry we won&apos;t get to capture these little moments this time. A confirmation is on its way to your inbox. If you&apos;d like to book another session in the future, we&apos;d love to see you.
            </p>
            <div className={styles.actions}>
              <Link href="/" className={cn(styles.link, "chalk-soft")}>Back to Tiny Humans</Link>
              <ChalkButton href="/bundles" variant="solid" seed={316}>Book another session</ChalkButton>
            </div>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
