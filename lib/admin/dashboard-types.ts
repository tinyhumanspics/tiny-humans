/** The owner dashboard (/admin): sessions coming up, then a month (or dates) of money, bookings, leads and changes. */
import type { BucketUnit, DashboardPeriod } from "./dashboard-period";

export interface DashboardSession {
  reference: string;
  /** Studio date (YYYY-MM-DD) and "HH:MM" times in the studio time zone. */
  date: string;
  start: string;
  end: string;
  parentName: string;
  bundleName: string;
  location: string;
  /** "pending" = the time is held while the family pays the deposit. */
  status: "pending" | "confirmed" | "rescheduled";
}

/** One bar of the chart: a day, a week (from Monday) or a month of the period. */
export interface DashboardBucket {
  /** First studio date of the bar. */
  start: string;
  paidCents: number;
  bookedCents: number;
  bookings: number;
  leads: number;
  /** Shoots on the calendar that day, week or month (by the day of the session). */
  shoots: number;
}

export interface DashboardShare {
  label: string;
  bookings: number;
  revenueCents: number;
}

export interface DashboardTotals {
  /** Money that came in: card payments for sessions, deposits kept (bookings and due dates), photo extras. */
  paidCents: number;
  paid: { depositCents: number; sessionCents: number; extrasCents: number; extrasOrders: number };
  /** Sessions booked in the period that are still on, and their full price (bundle + extra babies + travel). */
  bookedCents: number;
  bookings: number;
  /** Families who sent a request (one each); how many of them booked; how many still wait for the owner. */
  leads: number;
  leadsBooked: number;
  leadsWaiting: number;
  /**
   * Shoots on the calendar in the period (by the day of the session, still on; owner, Nov 25: so coming months show
   * something), their full price, and what's still to collect from them (full price minus deposit and card payment).
   */
  shoots: number;
  shootsCents: number;
  toCollectCents: number;
}

export interface Dashboard {
  today: string;
  /** Sessions from today through the next 6 days (not cancelled), soonest first. */
  upcoming: DashboardSession[];
  /** The dates the numbers below cover (owner, Nov 25: this month unless another is picked). */
  period: DashboardPeriod & { unit: BucketUnit };
  totals: DashboardTotals;
  /** The same numbers by day, week or month, oldest first. */
  buckets: DashboardBucket[];
  /** The period's bookings by bundle and by source, most first. */
  bundles: DashboardShare[];
  sources: DashboardShare[];
  /** In the period: cancelled sessions, time holds released because the deposit wasn't paid, reschedules. */
  changes: { cancelled: number; depositNotPaid: number; rescheduled: number };
  /** In the period: reminder/after-session emails sent or failed, delivery problems reported by Resend. */
  emails: { sent: number; failed: number; problems: number };
}
