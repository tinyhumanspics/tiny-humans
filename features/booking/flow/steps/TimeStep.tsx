"use client";

import { formatLongDate, formatTimeLabel, type DateKey, type TimeSlot } from "@/lib/booking";
import { fill } from "@/lib/email/messages";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import ChoiceCard from "../ChoiceCard";
import styles from "../Booking.module.css";
import { cn } from "@/lib/cn";

/** Step 2: the open start times of the chosen day (undefined = still loading). */
export default function TimeStep({ date, slots, selectedId, onSelect, locale, messages }: { date: DateKey; slots: TimeSlot[] | undefined; selectedId: string | undefined; onSelect: (slot: TimeSlot) => void; locale: AppLocale; messages: typeof en.bookingFlow.time }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={cn(styles.subtle, "chalk-soft")}>{formatLongDate(date, locale)} · {messages.zone}</legend>
      {slots === undefined ? (
        <p className={cn(styles.subtle, "chalk-soft")}>{messages.checking}</p>
      ) : slots.length === 0 ? (
        <p className={cn(styles.subtle, "chalk-soft")}>{messages.filled}</p>
      ) : (
        <div className={styles.slots}>
          {slots.map((slot, i) => (
            <ChoiceCard
              key={slot.id}
              name="time"
              value={slot.id}
              seed={400 + i}
              checked={selectedId === slot.id}
              onSelect={() => onSelect(slot)}
              title={formatTimeLabel(slot.start, locale)}
              detail={fill(messages.until, { time: formatTimeLabel(slot.end, locale) })}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}
