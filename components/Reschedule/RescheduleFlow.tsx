"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, formatLongDate, formatTimeLabel, fromDateKey, startOfDay, toDateKey, type DateKey, type DayAvailability, type TimeSlot } from "@/lib/booking";
import Calendar from "@/components/Booking/Calendar";
import ChoiceCard from "@/components/Booking/ChoiceCard";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import en from "@/messages/en.json";
import bstyles from "@/components/Booking/Booking.module.css";
import styles from "./Reschedule.module.css";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/email/messages";
import type { AppLocale } from "@/i18n/config";

export interface CurrentSession {
  date: DateKey;
  start: string;
  end: string;
}

interface Props {
  current: CurrentSession;
  /** Open times for this booking (server-side engine; the booking never blocks itself). */
  loadDays: (from: DateKey, to: DateKey) => Promise<DayAvailability[]>;
  /** Confirm the move (rechecked on the server). Throw an Error with code "slot_unavailable" if taken. */
  submit: (slot: { date: DateKey; start: string }) => Promise<void>;
  onKeep: () => void;
  keepLabel?: string;
  idPrefix?: string;
  locale?: AppLocale;
  messages?: typeof en.reschedulePage;
  bookingMessages?: typeof en.bookingFlow;
}

type Step = "date" | "time" | "review";

/** Choose new date -> time -> review -> confirm. Shared by the customer page and /admin Leads. */
export default function RescheduleFlow({ current, loadDays, submit, onKeep, keepLabel, idPrefix = "rs", locale = "en", messages = en.reschedulePage, bookingMessages = en.bookingFlow }: Props) {
  const t = messages.flow;
  const keep = keepLabel ?? t.keep;
  const { today: studioToday } = useCatalog();
  const today = startOfDay(fromDateKey(studioToday));
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [days, setDays] = useState<Record<DateKey, TimeSlot[]>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("date");
  const [date, setDate] = useState<DateKey | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (m: Date) => {
      setLoading(true);
      try {
        const from = toDateKey(new Date(m.getFullYear(), m.getMonth(), 1));
        const to = toDateKey(new Date(m.getFullYear(), m.getMonth() + 1, 0));
        const res = await loadDays(from, to);
        setDays((prev) => {
          const next = { ...prev };
          res.forEach((d) => (next[d.date] = d.slots));
          return next;
        });
      } catch (e) {
        setError(e instanceof Error && "code" in e && e.code === "rate_limited" ? messages.errors.rateLimited : e instanceof Error && "code" in e && e.code === "network" ? messages.errors.network : messages.errors.availability);
      } finally {
        setLoading(false);
      }
    },
    [loadDays, messages.errors.availability, messages.errors.network, messages.errors.rateLimited],
  );

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const confirm = async () => {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      await submit({ date: slot.date, start: slot.start });
    } catch (e) {
      const msg = (e as { code?: string }).code === "slot_unavailable" ? messages.errors.taken : (e as { code?: string }).code === "rate_limited" ? messages.errors.rateLimited : (e as { code?: string }).code === "network" ? messages.errors.network : messages.errors.submit;
      if ((e as { code?: string }).code === "slot_unavailable") {
        // that time is gone: reload live availability and go back to picking a time
        setDays({});
        setSlot(null);
        setStep("time");
        void load(month);
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const slotsForDate = date ? (days[date] ?? []).filter((s) => !(s.date === current.date && s.start === current.start)) : [];

  return (
    <div className={styles.flow}>
      <ol className={styles.steps} aria-label={t.stepsAria}>
        {(["date", "time", "review"] as Step[]).map((s, i) => (
          <li key={s} className={step === s ? styles.stepOn : ""} aria-current={step === s ? "step" : undefined}>
            <span className="chalk-soft">{i + 1}. {s === "date" ? t.newDate : s === "time" ? t.newTime : t.review}</span>
          </li>
        ))}
      </ol>
      {error && (
        <p className={cn(styles.error, "chalk-soft")} role="alert">
          {error}
        </p>
      )}

      {step === "date" && (
        <>
          <h3 className={cn(bstyles.stepTitle, "chalk")}>{t.chooseDay}</h3>
          <Calendar todayKey={studioToday} month={month} onMonthChange={setMonth} days={days} loading={loading} selected={date} onSelect={(d) => { setDate(d); setSlot(null); setError(null); }} messages={bookingMessages.calendar} locale={locale} />
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={onKeep} seed={421}>{keep}</ChalkButton>
            <ChalkButton variant="solid" disabled={!date} onClick={() => date && setStep("time")} seed={422}>{t.nextTime}</ChalkButton>
          </div>
        </>
      )}

      {step === "time" && date && (
        <>
          <h3 className={cn(bstyles.stepTitle, "chalk")}>{fill(t.pickTime, { date: formatLongDate(date, locale) })}</h3>
          <p className={cn(styles.muted, "chalk-soft")}>{t.zoneNote}</p>
          {slotsForDate.length === 0 ? (
            <p className={cn(styles.muted, "chalk-soft")}>{loading ? t.checking : t.noTimes}</p>
          ) : (
            <div className={bstyles.slots}>
              {slotsForDate.map((s, i) => (
                <ChoiceCard key={s.id} name={`${idPrefix}-time`} value={s.id} checked={slot?.id === s.id} onSelect={() => { setSlot(s); setError(null); }} title={formatTimeLabel(s.start, locale)} detail={fill(bookingMessages.time.until, { time: formatTimeLabel(s.end, locale) })} seed={500 + i} />
              ))}
            </div>
          )}
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={() => setStep("date")} seed={423}>{t.back}</ChalkButton>
            <ChalkButton variant="solid" disabled={!slot} onClick={() => slot && setStep("review")} seed={424}>{t.nextReview}</ChalkButton>
          </div>
        </>
      )}

      {step === "review" && slot && (
        <>
          <h3 className={cn(bstyles.stepTitle, "chalk")}>{t.check}</h3>
          <p className={cn(styles.muted, "chalk-soft")}>{t.zoneNote}</p>
          <div className={styles.compare}>
            <div className={styles.compareCol}>
              <p className={cn(styles.compareLabel, "chalk-soft")}>{t.current}</p>
              <p className={cn(styles.compareDate, styles.strike, "chalk-soft")}>{formatLongDate(current.date, locale)}</p>
              <p className={cn(styles.compareTime, styles.strike, "chalk-soft")}>{formatTimeLabel(current.start, locale)} – {formatTimeLabel(current.end, locale)}</p>
            </div>
            <span className={cn(styles.arrow, "chalk-soft")} aria-hidden="true">→</span>
            <div className={cn(styles.compareCol, styles.compareNew)}>
              <p className={cn(styles.compareLabel, "chalk-soft")}>{t.new}</p>
              <p className={cn(styles.compareDate, "chalk-soft")}>{formatLongDate(slot.date, locale)}</p>
              <p className={cn(styles.compareTime, "chalk-soft")}>{formatTimeLabel(slot.start, locale)} – {formatTimeLabel(slot.end, locale)}</p>
            </div>
          </div>
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={onKeep} seed={425}>{keep}</ChalkButton>
            <ChalkButton variant="solid" disabled={busy} onClick={confirm} seed={426}>{busy ? t.rescheduling : t.confirm}</ChalkButton>
          </div>
          <button type="button" className={cn(styles.textLink, "chalk-soft")} onClick={() => setStep("time")}>{t.different}</button>
        </>
      )}
    </div>
  );
}

export { addDays, fromDateKey };
