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

/** An active booking already on a date the owner wants to close. */
export interface ClosedDayBooking {
  reference: string;
  parentName: string;
  email: string;
  phone: string;
  start: string;
  end: string;
  /** Cancelled appears only when a closed deposit page still needs its schedule-change email retried. */
  status: "pending" | "confirmed" | "rescheduled" | "cancelled";
  notification: { status: "sending" | "sent" | "failed"; error: string | null } | null;
}

export interface ClosedDayImpact {
  date: string;
  bookings: ClosedDayBooking[];
}

export interface CloseDayResult {
  rules: AvailabilityRules;
  impact: ClosedDayImpact;
  sent: string[];
  alreadySent: string[];
  failed: { reference: string; error: string }[];
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
