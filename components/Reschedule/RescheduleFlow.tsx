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
}

type Step = "date" | "time" | "review";

/** Choose new date -> time -> review -> confirm. Shared by the customer page and /admin Leads. */
export default function RescheduleFlow({ current, loadDays, submit, onKeep, keepLabel = "Keep My Current Booking", idPrefix = "rs" }: Props) {
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
        setError(e instanceof Error ? e.message : "We couldn't load open times. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [loadDays],
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
      const msg = e instanceof Error ? e.message : "We couldn't reschedule just now. Please try again.";
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
      <ol className={styles.steps} aria-label="Reschedule steps">
        {(["date", "time", "review"] as Step[]).map((s, i) => (
          <li key={s} className={step === s ? styles.stepOn : ""} aria-current={step === s ? "step" : undefined}>
            <span className="chalk-soft">{i + 1}. {s === "date" ? "New date" : s === "time" ? "New time" : "Review"}</span>
          </li>
        ))}
      </ol>
      {error && (
        <p className={`${styles.error} chalk-soft`} role="alert">
          {error}
        </p>
      )}

      {step === "date" && (
        <>
          <h3 className={`${bstyles.stepTitle} chalk`}>Choose a new day</h3>
          <Calendar todayKey={studioToday} month={month} onMonthChange={setMonth} days={days} loading={loading} selected={date} onSelect={(d) => { setDate(d); setSlot(null); setError(null); }} />
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={onKeep} seed={421}>{keepLabel}</ChalkButton>
            <ChalkButton variant="solid" disabled={!date} onClick={() => date && setStep("time")} seed={422}>Next: Time</ChalkButton>
          </div>
        </>
      )}

      {step === "time" && date && (
        <>
          <h3 className={`${bstyles.stepTitle} chalk`}>Pick a time on {formatLongDate(date)}</h3>
          <p className={`${styles.muted} chalk-soft`}>{en.booking.timeZone.note}</p>
          {slotsForDate.length === 0 ? (
            <p className={`${styles.muted} chalk-soft`}>{loading ? "Checking the calendar…" : "No open times left on this day. Please choose another day."}</p>
          ) : (
            <div className={bstyles.slots}>
              {slotsForDate.map((s, i) => (
                <ChoiceCard key={s.id} name={`${idPrefix}-time`} value={s.id} checked={slot?.id === s.id} onSelect={() => { setSlot(s); setError(null); }} title={s.label} detail={`until ${formatTimeLabel(s.end)}`} seed={500 + i} />
              ))}
            </div>
          )}
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={() => setStep("date")} seed={423}>Back</ChalkButton>
            <ChalkButton variant="solid" disabled={!slot} onClick={() => slot && setStep("review")} seed={424}>Next: Review</ChalkButton>
          </div>
        </>
      )}

      {step === "review" && slot && (
        <>
          <h3 className={`${bstyles.stepTitle} chalk`}>Check the change</h3>
          <p className={`${styles.muted} chalk-soft`}>{en.booking.timeZone.note}</p>
          <div className={styles.compare}>
            <div className={styles.compareCol}>
              <p className={`${styles.compareLabel} chalk-soft`}>Current session</p>
              <p className={`${styles.compareDate} ${styles.strike} chalk-soft`}>{formatLongDate(current.date)}</p>
              <p className={`${styles.compareTime} ${styles.strike} chalk-soft`}>{formatTimeLabel(current.start)} – {formatTimeLabel(current.end)}</p>
            </div>
            <span className={`${styles.arrow} chalk-soft`} aria-hidden="true">→</span>
            <div className={`${styles.compareCol} ${styles.compareNew}`}>
              <p className={`${styles.compareLabel} chalk-soft`}>New session</p>
              <p className={`${styles.compareDate} chalk-soft`}>{formatLongDate(slot.date)}</p>
              <p className={`${styles.compareTime} chalk-soft`}>{formatTimeLabel(slot.start)} – {formatTimeLabel(slot.end)}</p>
            </div>
          </div>
          <div className={styles.actions}>
            <ChalkButton variant="outline" onClick={onKeep} seed={425}>{keepLabel}</ChalkButton>
            <ChalkButton variant="solid" disabled={busy} onClick={confirm} seed={426}>{busy ? "Rescheduling…" : "Confirm Reschedule"}</ChalkButton>
          </div>
          <button type="button" className={`${styles.textLink} chalk-soft`} onClick={() => setStep("time")}>Choose a different time</button>
        </>
      )}
    </div>
  );
}

export { addDays, fromDateKey };
