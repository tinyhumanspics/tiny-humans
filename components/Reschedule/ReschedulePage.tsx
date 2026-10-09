"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatLongDate, formatTimeLabel, getBookingClient, BookingApiError, type ManagedBooking } from "@/lib/booking";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import RescheduleFlow from "./RescheduleFlow";
import styles from "./Reschedule.module.css";
import { cn } from "@/lib/cn";
import { rescheduleClosedText } from "@/lib/booking/reschedule-policy";
import { fill } from "@/lib/email/messages";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import { site } from "@/config/site";
import en from "@/messages/en.json";

type View = "loading" | "invalid" | "ready" | "done";

/** Customer reschedule page (/reschedule?t=<management token>). Only date + time can change. */
export default function ReschedulePage({
  locale = "en",
  messages = en.reschedulePage,
  bookingMessages = en.bookingFlow,
  policyMessages = en.policy,
}: {
  locale?: AppLocale;
  messages?: typeof en.reschedulePage;
  bookingMessages?: typeof en.bookingFlow;
  policyMessages?: typeof en.policy;
}) {
  const token = useSearchParams().get("t") ?? "";
  const router = useRouter();
  const { getBundle } = useCatalog();
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
        setMessage(e instanceof BookingApiError && e.code === "network" ? messages.errors.network : e instanceof BookingApiError && e.code === "rate_limited" ? messages.errors.rateLimited : messages.errors.invalid);
        setView("invalid");
      });
  }, [token, client, messages]);

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
        if (e instanceof BookingApiError && e.code === "slot_unavailable") throw Object.assign(new Error(messages.errors.taken), { code: "slot_unavailable" });
        if (e instanceof BookingApiError && e.code === "reschedule_closed") {
          setBooking((b) => (b ? { ...b, canReschedule: false } : b));
        }
        const code = e instanceof BookingApiError ? e.code : "server_error";
        const text = code === "network" ? messages.errors.network : code === "rate_limited" ? messages.errors.rateLimited : messages.errors.submit;
        throw Object.assign(new Error(text), { code });
      }
    },
    [client, token, booking, messages],
  );

  const session = (b: ManagedBooking, title: string) => (
    <div className={styles.current}>
      <p className={cn(styles.currentTitle, "chalk-soft")}>{title}</p>
      <dl className={styles.details}>
        <div><dt className="chalk-soft">{messages.labels.reference}</dt><dd className="chalk-soft">{b.reference}</dd></div>
        <div><dt className="chalk-soft">{messages.labels.bundle}</dt><dd className="chalk-soft">{getBundle(b.bundleId)?.name ?? b.bundleName}</dd></div>
        <div><dt className="chalk-soft">{messages.labels.date}</dt><dd className="chalk-soft">{formatLongDate(b.date, locale)}</dd></div>
        <div><dt className="chalk-soft">{messages.labels.time}</dt><dd className="chalk-soft">{fill(messages.timeRange, { start: formatTimeLabel(b.start, locale), end: formatTimeLabel(b.end, locale) })}</dd></div>
        <div><dt className="chalk-soft">{messages.labels.location}</dt><dd className="chalk-soft">{locale === "es" ? b.location.replace(/,\s*Unit\s+/i, ", Unidad ") : b.location}</dd></div>
      </dl>
    </div>
  );

  return (
    <section className={cn("container", styles.page)} aria-labelledby="rs-title">
      <ChalkBox className={styles.panel} seed={411} wobble={3.4} strokeWidth={2.8}>
        {view === "loading" && <p className={cn(styles.muted, "chalk-soft")}>{messages.loading}</p>}

        {view === "invalid" && (
          <>
            <h1 id="rs-title" className={cn(styles.title, "chalk")}>{messages.invalidTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{message}</p>
            <ChalkButton href={localePath("/", locale)} variant="outline" seed={412}>{messages.home}</ChalkButton>
          </>
        )}

        {view === "ready" && booking && (
          <>
            <p className={cn(styles.eyebrow, "chalk-soft")}>{fill(messages.greeting, { name: booking.parentFirstName })}</p>
            <h1 id="rs-title" className={cn(styles.title, "chalk")}>{messages.title}</h1>
            {session(booking, messages.currentTitle)}
            {booking.status === "cancelled" ? (
              <p className={cn(styles.notice, "chalk-soft")}>{messages.cancelled}</p>
            ) : booking.status === "past" ? (
              <p className={cn(styles.notice, "chalk-soft")}>{messages.past}</p>
            ) : !booking.canReschedule ? (
              <>
                <p className={cn(styles.notice, "chalk-soft")}>{rescheduleClosedText(booking.rescheduleNoticeHours, policyMessages)}</p>
                <ChalkButton href={`sms:${site.contact.sms}`} variant="solid" seed={318}>{fill(policyMessages.textUs, { phone: site.contact.phone })}</ChalkButton>
              </>
            ) : (
              <>
                <p className={cn(styles.text, "chalk-soft")}>{messages.intro}</p>
                <RescheduleFlow current={booking} loadDays={loadDays} submit={submit} onKeep={() => router.push(localePath("/", locale))} locale={locale} messages={messages} bookingMessages={bookingMessages} />
              </>
            )}
            {(booking.status !== "active" || !booking.canReschedule) && (
              <div className={styles.actions}>
                <ChalkButton href={localePath("/", locale)} variant="outline" seed={413}>{messages.home}</ChalkButton>
                <a className={cn(styles.textLink, "chalk-soft")} href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
              </div>
            )}
          </>
        )}

        {view === "done" && booking && (
          <div role="status">
            <ChalkDoodle name="star" size={60} color="var(--sun-yellow)" strokeWidth={3} />
            <p className={cn(styles.eyebrow, "chalk-soft")}>{messages.doneEyebrow}</p>
            <h1 id="rs-title" className={cn(styles.title, "chalk")}>{messages.doneTitle}</h1>
            <p className={cn(styles.text, "chalk-soft")}>{messages.doneText}</p>
            {previous && <p className={cn(styles.muted, "chalk-soft")}>{fill(messages.previous, { date: formatLongDate(previous.date, locale), time: formatTimeLabel(previous.start, locale) })}</p>}
            {session(booking, messages.newTitle)}
            <p className={cn(styles.text, "chalk-soft")}>{messages.doneLinks}</p>
            <ChalkButton href={localePath("/", locale)} variant="outline" seed={414}>{messages.home}</ChalkButton>
          </div>
        )}
      </ChalkBox>
    </section>
  );
}
