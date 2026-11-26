import { todayInZone } from "@/lib/booking/timezone";
import { sourceLabel } from "@/lib/tracking/attribution";
import { bucketKey, bucketStarts, type BucketUnit, type DashboardPeriod } from "./dashboard-period";
import type { DashboardBucket, DashboardShare, DashboardTotals } from "./dashboard-types";

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

/** A request from /book or a booking link: a lead. */
export interface DashboardRequestRow {
  createdAt: Date;
  mobile: string;
  email: string;
  /** new (waiting for the owner) · confirmed (waiting for the deposit) · booked · declined · expired */
  status: string;
}

/** A session on the calendar in the period (still on), with what was paid for it so far. */
export interface DashboardShootRow {
  /** Studio date of the session (YYYY-MM-DD). */
  sessionDate: string;
  totalCents: number;
  /** The deposit kept, in cents (0 without one). */
  depositCents: number;
  /** The rest was paid by card. */
  paidInFull: boolean;
}

/** Money that came in: a card payment for the session, a deposit kept, or photo extras. */
export interface DashboardPaymentRow {
  paidAt: Date;
  cents: number;
  kind: "session" | "deposit" | "extras";
}

const isOn = (r: DashboardBookingRow) => r.status === "confirmed" || r.status === "rescheduled";
const depositNotPaid = (r: DashboardBookingRow) => r.depositStatus === "expired" || r.depositStatus === "unpaid";
/** One lead per family: the same mobile (its last 10 digits; or, without one, the same email) sending twice counts once. */
const familyOf = (r: DashboardRequestRow) => r.mobile.replace(/\D/g, "").slice(-10) || r.email.trim().toLowerCase();

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

/**
 * The period's numbers (studio dates in `timeZone`): money paid, sessions booked (made in the period and still on),
 * leads (families who sent a request), shoots on the calendar and what's left to collect from them, each by day, week
 * or month; bookings by bundle and source; cancellations.
 */
export function summarizePeriod(
  input: { bookings: DashboardBookingRow[]; requests: DashboardRequestRow[]; payments: DashboardPaymentRow[]; shoots: DashboardShootRow[] },
  period: DashboardPeriod,
  unit: BucketUnit,
  timeZone: string,
) {
  const dayOf = (d: Date) => todayInZone(timeZone, d);
  const inPeriod = (d: Date | null): d is Date => !!d && dayOf(d) >= period.from && dayOf(d) <= period.to;
  const buckets: DashboardBucket[] = bucketStarts(period, unit).map((start) => ({ start, paidCents: 0, bookedCents: 0, bookings: 0, leads: 0, shoots: 0 }));
  const bucketOf = new Map(buckets.map((b) => [b.start, b]));
  const bar = (d: Date) => bucketOf.get(bucketKey(dayOf(d), unit));

  const totals: DashboardTotals = { paidCents: 0, paid: { depositCents: 0, sessionCents: 0, extrasCents: 0, extrasOrders: 0 }, bookedCents: 0, bookings: 0, leads: 0, leadsBooked: 0, leadsWaiting: 0, shoots: 0, shootsCents: 0, toCollectCents: 0 };

  for (const p of input.payments.filter((p) => inPeriod(p.paidAt))) {
    totals.paidCents += p.cents;
    if (p.kind === "deposit") totals.paid.depositCents += p.cents;
    else if (p.kind === "session") totals.paid.sessionCents += p.cents;
    else {
      totals.paid.extrasCents += p.cents;
      totals.paid.extrasOrders += 1;
    }
    const b = bar(p.paidAt);
    if (b) b.paidCents += p.cents;
  }

  const booked = input.bookings.filter((r) => isOn(r) && inPeriod(r.createdAt));
  for (const r of booked) {
    totals.bookings += 1;
    totals.bookedCents += r.totalCents;
    const b = bar(r.createdAt);
    if (b) {
      b.bookings += 1;
      b.bookedCents += r.totalCents;
    }
  }

  // a family counts once, on the day of its first request in the period; booked if any of its requests got booked
  const families = new Map<string, { first: Date; booked: boolean; waiting: boolean }>();
  for (const r of [...input.requests].filter((r) => inPeriod(r.createdAt)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const key = familyOf(r);
    const f = families.get(key) ?? { first: r.createdAt, booked: false, waiting: false };
    f.booked ||= r.status === "booked";
    f.waiting ||= r.status === "new";
    families.set(key, f);
  }
  for (const f of families.values()) {
    totals.leads += 1;
    if (f.booked) totals.leadsBooked += 1;
    else if (f.waiting) totals.leadsWaiting += 1;
    const b = bar(f.first);
    if (b) b.leads += 1;
  }

  for (const r of input.shoots.filter((r) => r.sessionDate >= period.from && r.sessionDate <= period.to)) {
    totals.shoots += 1;
    totals.shootsCents += r.totalCents;
    if (!r.paidInFull) totals.toCollectCents += Math.max(0, r.totalCents - r.depositCents);
    const b = bucketOf.get(bucketKey(r.sessionDate, unit));
    if (b) b.shoots += 1;
  }

  const cancelled = input.bookings.filter((r) => r.status === "cancelled" && inPeriod(r.cancelledAt));
  return {
    totals,
    buckets,
    bundles: shares(booked, (r) => r.bundleName),
    sources: shares(booked, (r) =>
      sourceLabel({ utmSource: r.utmSource ?? undefined, utmMedium: r.utmMedium ?? undefined, fbclid: r.fbclid ?? undefined, referrer: r.referrer ?? undefined }),
    ),
    cancelled: cancelled.filter((r) => !depositNotPaid(r)).length,
    depositNotPaid: cancelled.filter(depositNotPaid).length,
  };
}
