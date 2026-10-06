"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatLongDate, formatTimeLabel, getBookingClient, BookingApiError, type ManagedBooking } from "@/lib/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import RescheduleFlow from "./RescheduleFlow";
import styles from "./Reschedule.module.css";

type View = "loading" | "invalid" | "ready" | "done";

/** Customer reschedule page (/reschedule?t=<management token>). Only date + time can change. */
export default function ReschedulePage() {
  const token = useSearchParams().get("t") ?? "";
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [previous, setPrevious] = useState<ManagedBooking | null>(null);
  const [message, setMessage] = useState("");
  const client = getBookingClient();

  useEffect(() => {
    if (!token) return setView("invalid");
    client
      .getManagedBooking(token)
      .then((b) => {
        setBooking(b);
        setView("ready");
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : "This link isn't valid anymore.");
        setView("invalid");
      });
  }, [token, client]);

  const loadDays = useCallback((from: string, to: string) => client.getRescheduleAvailability(token, from, to), [client, token]);
  const submit = useCallback(
    async (slot: { date: string; start: string }) => {
      try {
        const updated = await client.rescheduleWithToken(token, slot);
        setPrevious(booking);
        setBooking(updated);
        setView("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        if (e instanceof BookingApiError && e.code === "slot_unavailable") throw Object.assign(new Error(e.message), { code: "slot_unavailable" });
        if (e instanceof BookingApiError && e.code === "reschedule_closed") {
          setBooking((b) => (b ? { ...b, canReschedule: false } : b));
        }
        throw e;
      }
    },
    [client, token, booking],
  );

  const session = (b: ManagedBooking, title: string) => (
    <div className={styles.current}>
      <p className={`${styles.currentTitle} chalk-soft`}>{title}</p>
      <dl className={styles.details}>
        <div><dt className="chalk-soft">Booking reference</dt><dd className="chalk-soft">{b.reference}</dd></div>
        <div><dt className="chalk-soft">Bundle</dt><dd className="chalk-soft">{b.bundleName}</dd></div>
        <div><dt className="chalk-soft">Date</dt><dd className="chalk-soft">{formatLongDate(b.date)}</dd></div>
        <div><dt className="chalk-soft">Time</dt><dd className="chalk-soft">{formatTimeLabel(b.start)} – {formatTimeLabel(b.end)}</dd></div>
        <div><dt className="chalk-soft">Location</dt><dd className="chalk-soft">{b.location}</dd></div>
      </dl>
    </div>
  );

  return (
    <section className={`container ${styles.page}`} aria-labelledby="rs-title">
      <ChalkBox className={styles.panel} seed={411} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={`${styles.muted} chalk-soft`}>Finding your booking…</p>}

        {view === "invalid" && (
          <>
            <h1 id="rs-title" className={`${styles.title} chalk`}>We couldn&apos;t open this link</h1>
            <p className={`${styles.text} chalk-soft`}>{message}</p>
            <ChalkButton href="/" variant="outline" seed={412}>Back to Tiny Humans</ChalkButton>
          </>
        )}

        {view === "ready" && booking && (
          <>
            <p className={`${styles.eyebrow} chalk-soft`}>Hi {booking.parentFirstName}</p>
            <h1 id="rs-title" className={`${styles.title} chalk`}>Reschedule your session</h1>
            {session(booking, "Your Current Session")}
            {booking.status === "cancelled" ? (
              <p className={`${styles.notice} chalk-soft`}>This booking has already been cancelled.</p>
            ) : booking.status === "past" ? (
              <p className={`${styles.notice} chalk-soft`}>This session has already taken place.</p>
            ) : !booking.canReschedule ? (
              <p className={`${styles.notice} chalk-soft`}>
                This session is less than {booking.rescheduleNoticeHours} hours away, so online rescheduling is no longer available. Please contact Tiny Humans if you need help with your appointment.
              </p>
            ) : (
              <>
                <p className={`${styles.text} chalk-soft`}>You can change the day and time. Everything else stays the same.</p>
                <RescheduleFlow current={booking} loadDays={loadDays} submit={submit} onKeep={() => router.push("/")} />
              </>
            )}
            {(booking.status !== "active" || !booking.canReschedule) && (
              <div className={styles.actions}>
                <ChalkButton href="/" variant="outline" seed={413}>Back to Tiny Humans</ChalkButton>
                <a className={`${styles.textLink} chalk-soft`} href="mailto:hello@tinyhumans.photography">hello@tinyhumans.photography</a>
              </div>
            )}
          </>
        )}

        {view === "done" && booking && (
          <div role="status">
            <ChalkDoodle name="star" size={60} color="var(--sun-yellow)" strokeWidth={3} />
            <p className={`${styles.eyebrow} chalk-soft`}>Booking rescheduled</p>
            <h1 id="rs-title" className={`${styles.title} chalk`}>You&apos;re all set!</h1>
            <p className={`${styles.text} chalk-soft`}>
              Your Tiny Humans session has been successfully rescheduled. We&apos;ve updated your appointment and can&apos;t wait to capture these little moments with you.
            </p>
            {previous && <p className={`${styles.muted} chalk-soft`}>Previously: {formatLongDate(previous.date)}, {formatTimeLabel(previous.start)}</p>}
            {session(booking, "Your New Session")}
            <p className={`${styles.text} chalk-soft`}>A confirmation with new links to manage your booking is on its way to your inbox.</p>
            <ChalkButton href="/" variant="outline" seed={414}>Back to Tiny Humans</ChalkButton>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
