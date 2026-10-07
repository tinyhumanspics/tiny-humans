"use client";

import { useMemo } from "react";
import { bookingSettings } from "@/config/booking";
import { addDays, fromDateKey, startOfDay, toDateKey, type DateKey, type TimeSlot } from "@/lib/booking";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  /** Today in the studio's time zone (YYYY-MM-DD). */
  todayKey: DateKey;
  month: Date;
  onMonthChange: (month: Date) => void;
  days: Record<DateKey, TimeSlot[]>;
  loading: boolean;
  selected: DateKey | null;
  onSelect: (date: DateKey) => void;
}

export default function Calendar({ todayKey, month, onMonthChange, days, loading, selected, onSelect }: Props) {
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

  const title = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
          aria-label="Previous month"
        >
          <ChalkDoodle name="arrowLeft" size={28} />
        </button>
        <p className={cn(styles.calTitle, "chalk-soft")} aria-live="polite">{title}</p>
        <button
          type="button"
          className={styles.calNav}
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="Next month"
        >
          <ChalkDoodle name="arrowRight" size={28} />
        </button>
      </div>

      <div className={styles.calGrid} role="grid" aria-label={`${title} availability`} aria-busy={loading}>
        <div role="row" className={styles.calRow}>
          {WEEKDAYS.map((d) => (
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
              const label = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              return (
                <span role="gridcell" key={key}>
                  <button
                    type="button"
                    className={cn(styles.calDay, available ? styles.calAvailable : "", isSelected ? styles.calSelected : "", isToday ? styles.calToday : "")}
                    disabled={!available}
                    aria-pressed={isSelected}
                    aria-label={`${label}, ${available ? `${slots.length} times available` : known ? "unavailable" : "checking"}`}
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
        {loading ? "Checking the calendar…" : "Faded days are booked or closed."}
      </p>
    </div>
  );
}
