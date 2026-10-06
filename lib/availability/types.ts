/** Owner-managed availability (stored in Neon; shared by all booking providers). */

export interface WeeklyDay {
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  isOpen: boolean;
  /** "HH:MM" local time */
  start: string;
  end: string;
}

export interface BookingLimits {
  /** 0 = same day */
  minimumNoticeDays: number;
  bookingWindowDays: number;
  /** Kept free before and after every session. */
  bufferMinutes: number;
  /** Customers can reschedule online until this many hours before their session. */
  rescheduleNoticeHours: number;
}

/** A special date: closed all day, or custom hours that replace the weekly schedule. */
export interface DateOverride {
  date: string;
  isClosed: boolean;
  start?: string;
  end?: string;
}

/** A blocked time period (e.g. a personal appointment). */
export interface TimeBlock {
  id: string;
  date: string;
  start: string;
  end: string;
  reason?: string;
}

export interface AvailabilityRules {
  weekly: WeeklyDay[];
  limits: BookingLimits;
  overrides: DateOverride[];
  blocks: TimeBlock[];
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
