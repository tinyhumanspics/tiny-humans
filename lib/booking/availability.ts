import { bookingRules } from "@/config/booking";
import type { AvailabilityRules } from "@/lib/availability/types";
import { addMinutes, formatTimeLabel } from "./dates";
import { addDaysKey, todayInZone, weekdayOf, zonedTimeToUtc } from "./timezone";
import type { DayAvailability, TimeSlot } from "./types";

export interface Busy {
  start: Date;
  end: Date;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Opening hours for a date: a special date overrides the weekly schedule. null = closed. */
export function hoursFor(date: string, rules: AvailabilityRules): { open: string; close: string } | null {
  const o = rules.overrides.find((x) => x.date === date);
  if (o) return o.isClosed || !o.start || !o.end ? null : { open: o.start, close: o.end };
  const w = rules.weekly.find((x) => x.weekday === weekdayOf(date));
  return w && w.isOpen ? { open: w.start, close: w.end } : null;
}

/** Start times inside opening hours, every slotIntervalMinutes from opening. */
export function candidateStarts(date: string, durationMinutes: number, rules: AvailabilityRules): string[] {
  const h = hoursFor(date, rules);
  if (!h) return [];
  const open = toMin(h.open);
  const close = toMin(h.close);
  const out: string[] = [];
  for (let m = open; m + durationMinutes <= close; m += bookingRules.slotIntervalMinutes) out.push(fmt(m));
  return out;
}

/** Is this date inside the minimum notice and booking window? */
export function dateBookable(date: string, rules: AvailabilityRules, now = new Date()): boolean {
  const today = todayInZone(bookingRules.timeZone, now);
  return date >= addDaysKey(today, rules.limits.minimumNoticeDays) && date <= addDaysKey(today, rules.limits.bookingWindowDays);
}

/**
 * Slots for one day. A slot appears only if it is inside the owner's hours
 * (weekly schedule or special date), within the notice/booking window, in the
 * future, and clear of busy time (Outlook events, active bookings, manual
 * time blocks) including the buffer before and after the session.
 */
export function slotsForDay(date: string, durationMinutes: number, busy: Busy[], rules: AvailabilityRules, now = new Date()): TimeSlot[] {
  if (!dateBookable(date, rules, now)) return [];
  const tz = bookingRules.timeZone;
  const buffer = rules.limits.bufferMinutes * 60_000;
  const blocks: Busy[] = rules.blocks
    .filter((b) => b.date === date)
    .map((b) => ({ start: zonedTimeToUtc(date, b.start, tz), end: zonedTimeToUtc(date, b.end, tz) }));
  const allBusy = [...busy, ...blocks];
  return candidateStarts(date, durationMinutes, rules)
    .filter((start) => {
      const s = zonedTimeToUtc(date, start, tz).getTime();
      if (s <= now.getTime()) return false;
      const blockStart = s - buffer;
      const blockEnd = s + durationMinutes * 60_000 + buffer;
      return !allBusy.some((b) => b.start.getTime() < blockEnd && b.end.getTime() > blockStart);
    })
    .map((start) => ({ id: `${date}T${start}`, date, start, end: addMinutes(start, durationMinutes), label: formatTimeLabel(start) }));
}

export function availabilityForRange(from: string, to: string, durationMinutes: number, busy: Busy[], rules: AvailabilityRules, now = new Date()): DayAvailability[] {
  const days: DayAvailability[] = [];
  for (let d = from; d <= to; d = addDaysKey(d, 1)) days.push({ date: d, slots: slotsForDay(d, durationMinutes, busy, rules, now) });
  return days;
}
