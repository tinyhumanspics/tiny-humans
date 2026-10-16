/** The owner dashboard (/admin): sessions coming up, bookings over time, where they come from, changes and emails. */

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

export interface DashboardWeek {
  /** Monday of the week (studio date). */
  weekStart: string;
  bookings: number;
  revenueCents: number;
}

export interface DashboardShare {
  label: string;
  bookings: number;
  revenueCents: number;
}

export interface Dashboard {
  today: string;
  /** Sessions from today through the next 6 days (not cancelled), soonest first. */
  upcoming: DashboardSession[];
  /** Bookings made each week that are still on (confirmed or rescheduled), oldest week first. */
  weeks: DashboardWeek[];
  /** The same bookings by bundle and by source, most first. */
  bundles: DashboardShare[];
  sources: DashboardShare[];
  /** Over the same weeks: cancelled sessions, time holds released because the deposit wasn't paid, reschedules. */
  changes: { cancelled: number; depositNotPaid: number; rescheduled: number };
  /** Over the last `days` days: reminder/after-session emails sent or failed, delivery problems reported by Resend. */
  emails: { days: number; sent: number; failed: number; problems: number };
}
