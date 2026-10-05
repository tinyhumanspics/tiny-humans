import { bookingRules, candidateStartTimes } from "@/config/booking";
import { addMinutes, formatTimeLabel } from "./dates";
import { addDaysKey, todayInZone, weekdayOf, zonedTimeToUtc } from "./timezone";
import type { DayAvailability, TimeSlot } from "./types";

export interface Busy {
  start: Date;
  end: Date;
}

/**
 * Real-calendar slot engine: candidate start times from config, minus
 * anything overlapping a busy period (with travel buffers), outside the
 * lead time / booking window, or past closing time.
 */
export function slotsForDay(date: string, durationMinutes: number, busy: Busy[], now = new Date()): TimeSlot[] {
  const tz = bookingRules.timeZone;
  const today = todayInZone(tz, now);
  if (date < today || date > addDaysKey(today, bookingRules.bookingWindowDays)) return [];
  const earliest = now.getTime() + bookingRules.minimumLeadTimeHours * 3_600_000;
  const before = bookingRules.sessionBuffers.beforeMinutes * 60_000;
  const after = bookingRules.sessionBuffers.afterMinutes * 60_000;
  return candidateStartTimes(durationMinutes, weekdayOf(date))
    .filter((start) => {
      const s = zonedTimeToUtc(date, start, tz).getTime();
      if (s < earliest) return false;
      const blockStart = s - before;
      const blockEnd = s + durationMinutes * 60_000 + after;
      return !busy.some((b) => b.start.getTime() < blockEnd && b.end.getTime() > blockStart);
    })
    .map((start) => ({ id: `${date}T${start}`, date, start, end: addMinutes(start, durationMinutes), label: formatTimeLabel(start) }));
}

export function availabilityForRange(from: string, to: string, durationMinutes: number, busy: Busy[], now = new Date()): DayAvailability[] {
  const days: DayAvailability[] = [];
  for (let d = from; d <= to; d = addDaysKey(d, 1)) days.push({ date: d, slots: slotsForDay(d, durationMinutes, busy, now) });
  return days;
}
