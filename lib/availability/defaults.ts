import { bookingRules } from "@/config/booking";
import type { AvailabilityRules, WeeklyDay } from "./types";

export function defaultAvailabilityRules(): AvailabilityRules {
  const d = bookingRules.defaults;
  return {
    weekly: d.weekly.map((w) => ({ ...w })),
    limits: { minimumNoticeDays: d.minimumNoticeDays, bookingWindowDays: d.bookingWindowDays, bufferMinutes: d.bufferMinutes },
    overrides: [],
    blocks: [],
  };
}

/** Always 7 days, in weekday order (missing days filled from the defaults). */
export function completeWeekly(days: WeeklyDay[]): WeeklyDay[] {
  const byDay = new Map(days.map((d) => [d.weekday, d]));
  return bookingRules.defaults.weekly.map((def) => ({ ...(byDay.get(def.weekday) ?? def) }));
}

/** "09:00:00" (Postgres time) -> "09:00" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);
