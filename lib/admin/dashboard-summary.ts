import { addDaysKey, todayInZone } from "@/lib/booking/timezone";
import { sourceLabel } from "@/lib/tracking/attribution";
import type { DashboardShare, DashboardWeek } from "./dashboard-types";

/** Weeks of history on the dashboard (this week included). */
export const DASHBOARD_WEEKS = 12;

/** A booking as the dashboard counts it (see lib/admin/dashboard.ts for the query). */
export interface DashboardBookingRow {
  createdAt: Date;
  cancelledAt: Date | null;
  status: "pending" | "confirmed" | "rescheduled" | "cancelled";
  bundleName: string;
  /** Booked total: bundle after offer/code + extra babies + travel fee. */
  totalCents: number;
  utmSource: string | null;
  utmMedium: string | null;
  fbclid: string | null;
  referrer: string | null;
  /** The booking's deposit, if it had one ("expired"/"unpaid" = the hold was released, never a real booking). */
  depositStatus: string | null;
}

/** Monday of the week that contains a studio date (YYYY-MM-DD). */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysKey(dateKey, -((weekday + 6) % 7));
}

/** First studio date the weekly numbers cover: the Monday DASHBOARD_WEEKS weeks back (this week included). */
export function windowStartKey(today: string): string {
  return addDaysKey(weekStartKey(today), -7 * (DASHBOARD_WEEKS - 1));
}

const isOn = (r: DashboardBookingRow) => r.status === "confirmed" || r.status === "rescheduled";
const depositNotPaid = (r: DashboardBookingRow) => r.depositStatus === "expired" || r.depositStatus === "unpaid";

function shares(rows: DashboardBookingRow[], labelOf: (r: DashboardBookingRow) => string): DashboardShare[] {
  const byLabel = new Map<string, DashboardShare>();
  for (const r of rows) {
    const label = labelOf(r);
    const share = byLabel.get(label) ?? { label, bookings: 0, revenueCents: 0 };
    share.bookings += 1;
    share.revenueCents += r.totalCents;
    byLabel.set(label, share);
  }
  return [...byLabel.values()].sort((a, b) => b.bookings - a.bookings || b.revenueCents - a.revenueCents || a.label.localeCompare(b.label));
}

/** Weekly bookings + revenue, bundle and source shares, and cancellations (studio dates, `timeZone`). */
export function summarizeBookings(rows: DashboardBookingRow[], today: string, timeZone: string) {
  const start = windowStartKey(today);
  const weeks: DashboardWeek[] = Array.from({ length: DASHBOARD_WEEKS }, (_, i) => ({ weekStart: addDaysKey(start, 7 * i), bookings: 0, revenueCents: 0 }));
  const byWeek = new Map(weeks.map((w) => [w.weekStart, w]));
  const booked = rows.filter((r) => isOn(r) && todayInZone(timeZone, r.createdAt) >= start);
  for (const r of booked) {
    const week = byWeek.get(weekStartKey(todayInZone(timeZone, r.createdAt)));
    if (!week) continue;
    week.bookings += 1;
    week.revenueCents += r.totalCents;
  }
  const cancelled = rows.filter((r) => r.status === "cancelled" && r.cancelledAt && todayInZone(timeZone, r.cancelledAt) >= start);
  return {
    weeks,
    bundles: shares(booked, (r) => r.bundleName),
    sources: shares(booked, (r) =>
      sourceLabel({ utmSource: r.utmSource ?? undefined, utmMedium: r.utmMedium ?? undefined, fbclid: r.fbclid ?? undefined, referrer: r.referrer ?? undefined }),
    ),
    cancelled: cancelled.filter((r) => !depositNotPaid(r)).length,
    depositNotPaid: cancelled.filter(depositNotPaid).length,
  };
}
