"use client";

import { useMemo } from "react";
import { bookingSettings } from "@/config/booking";
import { addDays, formatLongDate, fromDateKey, startOfDay, toDateKey, type DateKey, type TimeSlot } from "@/lib/booking";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

interface Props {
  /** Today in the studio's time zone (YYYY-MM-DD). */
  todayKey: DateKey;
  month: Date;
  onMonthChange: (month: Date) => void;
  days: Record<DateKey, TimeSlot[]>;
  loading: boolean;
  selected: DateKey | null;
  onSelect: (date: DateKey) => void;
  messages: typeof en.bookingFlow.calendar;
  locale: AppLocale;
}

export default function Calendar({ todayKey, month, onMonthChange, days, loading, selected, onSelect, messages, locale }: Props) {
  const today = startOfDay(fromDateKey(todayKey));
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = addDays(today, bookingSettings.maxDaysAhead);
  const lastMonth = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= count; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    return out;
  }, [month]);

  const title = fill(messages.monthTitle, { month: messages.months[month.getMonth()], year: String(month.getFullYear()) });
  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;

  return (
    <div className={styles.calendar}>
      <div className={styles.calHeader}>
        <button
          type="button"
          className={styles.calNav}
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label={messages.previousMonth}
        >
          <ChalkDoodle name="arrowLeft" size={28} />
        </button>
        <p className={cn(styles.calTitle, "chalk-soft")} aria-live="polite">{title}</p>
        <button
          type="button"
          className={styles.calNav}
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label={messages.nextMonth}
        >
          <ChalkDoodle name="arrowRight" size={28} />
        </button>
      </div>

      <div className={styles.calGrid} role="grid" aria-label={fill(messages.availability, { month: title })} aria-busy={loading}>
        <div role="row" className={styles.calRow}>
          {messages.weekdays.map((d) => (
            <span role="columnheader" key={d} className={cn(styles.calWeekday, "chalk-soft")}>{d}</span>
          ))}
        </div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
          <div role="row" className={styles.calRow} key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((date, c) => {
              if (!date) return <span role="gridcell" key={`e${c}`} className={styles.calEmpty} />;
              const key = toDateKey(date);
              const slots = days[key];
              const known = slots !== undefined;
              const available = known && slots.length > 0;
              const isSelected = selected === key;
              const isToday = toDateKey(today) === key;
              const label = formatLongDate(key, locale);
              const availability = available
                ? slots.length === 1
                  ? messages.oneTime
                  : fill(messages.manyTimes, { count: String(slots.length) })
                : known
                  ? messages.unavailable
                  : messages.checking;
              return (
                <span role="gridcell" key={key}>
                  <button
                    type="button"
                    className={cn(styles.calDay, available ? styles.calAvailable : "", isSelected ? styles.calSelected : "", isToday ? styles.calToday : "")}
                    disabled={!available}
                    aria-pressed={isSelected}
                    aria-label={`${label}, ${availability}`}
                    onClick={() => onSelect(key)}
                  >
                    <span className={cn(styles.calNum, "chalk-soft")}>{date.getDate()}</span>
                    {isSelected && <ChalkDoodle name="circle" size="100%" color="var(--sun-yellow)" strokeWidth={4} className={styles.calCircle} stretch />}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p className={cn(styles.calLegend, "chalk-soft")}>
        {loading ? messages.loading : messages.closed}
      </p>
    </div>
  );
}
