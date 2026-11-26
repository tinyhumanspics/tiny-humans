import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, lt, lte, or, sql, type Column } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { addDaysKey, todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import { getDb, isMissingTable } from "@/lib/db/client";
import { bookingDeposits, bookingEmails, bookingPayments, bookingRequests, bookingRescheduleHistory, bookings, dueDateReservations, emailEvents, photoExtraOrders } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { monthOf, unitFor, type DashboardPeriod } from "./dashboard-period";
import type { Dashboard, DashboardSession } from "./dashboard-types";
import { summarizePeriod, type DashboardBookingRow, type DashboardPaymentRow, type DashboardRequestRow, type DashboardShootRow } from "./dashboard-summary";

/** Today plus the next six days. */
const UPCOMING_DAYS = 7;

const hhmm = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

/** A table added by a later migration reads as empty until it exists; any other failure is logged and reads as empty. */
const orNone = <T,>(what: string) => (err: unknown): T[] => {
  if (!isMissingTable(err)) log.error("dashboard", `Could not load ${what}`, { error: err as Error });
  return [];
};

/**
 * Everything the owner dashboard shows, read fresh from Neon (owner only; never cached): the sessions of the next 7
 * days and the numbers of `period` (studio dates, this month when none is given).
 */
export async function getDashboard(period?: DashboardPeriod, now = new Date()): Promise<Dashboard> {
  const timeZone = bookingRules.timeZone;
  const today = todayInZone(timeZone, now);
  const p = period ?? monthOf(today);
  const unit = unitFor(p);
  const start = zonedTimeToUtc(p.from, "00:00", timeZone);
  const end = zonedTimeToUtc(addDaysKey(p.to, 1), "00:00", timeZone);
  const within = (col: Column) => and(gte(col, start), lt(col, end));
  const totalCents = sql<number>`coalesce(${bookings.finalPriceCents}, ${bookings.packagePrice} * 100) + coalesce(${bookings.addonsTotalCents}, 0) + coalesce(${bookings.travelFeeCents}, 0)`.mapWith(Number);
  const db = getDb();
  const [rows, upcoming, [reschedules], emailRows, [problems], requests, sessionPaid, depositsKept, dueDeposits, extras, shoots] = await Promise.all([
    db
      .select({
        createdAt: bookings.createdAt,
        cancelledAt: bookings.cancelledAt,
        status: bookings.status,
        bundleName: bookings.packageName,
        totalCents,
        utmSource: bookings.utmSource,
        utmMedium: bookings.utmMedium,
        fbclid: bookings.fbclid,
        referrer: bookings.referrer,
        depositStatus: bookingDeposits.status,
      })
      .from(bookings)
      .leftJoin(bookingDeposits, eq(bookingDeposits.bookingId, bookings.id))
      .where(or(within(bookings.createdAt), within(bookings.cancelledAt))),
    db
      .select({
        reference: bookings.bookingReference,
        date: bookings.sessionDate,
        start: bookings.sessionStart,
        end: bookings.sessionEnd,
        parentName: bookings.parentName,
        bundleName: bookings.packageName,
        location: bookings.locationAddress,
        status: bookings.status,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.sessionDate, today),
          lte(bookings.sessionDate, addDaysKey(today, UPCOMING_DAYS - 1)),
          inArray(bookings.status, ["pending", "confirmed", "rescheduled"]),
        ),
      )
      .orderBy(asc(bookings.sessionStart)),
    db.select({ n: count() }).from(bookingRescheduleHistory).where(within(bookingRescheduleHistory.createdAt)),
    db.select({ status: bookingEmails.status, n: count() }).from(bookingEmails).where(within(bookingEmails.createdAt)).groupBy(bookingEmails.status),
    db.select({ n: count() }).from(emailEvents).where(within(emailEvents.occurredAt)),
    // leads: requests from /book and booking links (migration 0037)
    db
      .select({ createdAt: bookingRequests.createdAt, mobile: bookingRequests.mobile, email: bookingRequests.email, status: bookingRequests.status })
      .from(bookingRequests)
      .where(within(bookingRequests.createdAt))
      .catch(orNone<DashboardRequestRow>("requests")),
    // money in: card payments for sessions, deposits kept, due-date deposits not moved to a booking yet, photo extras
    db
      .select({ paidAt: bookingPayments.paidAt, cents: bookingPayments.amountCents })
      .from(bookingPayments)
      .where(and(eq(bookingPayments.status, "paid"), within(bookingPayments.paidAt)))
      .catch(orNone<{ paidAt: Date | null; cents: number }>("card payments")),
    db
      .select({ paidAt: bookingDeposits.paidAt, cents: bookingDeposits.amountCents })
      .from(bookingDeposits)
      .where(and(eq(bookingDeposits.status, "paid"), within(bookingDeposits.paidAt)))
      .catch(orNone<{ paidAt: Date | null; cents: number }>("deposits")),
    db
      .select({ paidAt: dueDateReservations.depositPaidAt, cents: dueDateReservations.depositCents })
      .from(dueDateReservations)
      // once the session is booked, the deposit is the booking's (carryDueDeposit) and counted above
      .where(and(eq(dueDateReservations.depositStatus, "paid"), isNull(dueDateReservations.bookingId), within(dueDateReservations.depositPaidAt)))
      .catch(orNone<{ paidAt: Date | null; cents: number }>("due-date deposits")),
    db
      .select({ paidAt: photoExtraOrders.paidAt, cents: photoExtraOrders.totalCents })
      .from(photoExtraOrders)
      .where(and(eq(photoExtraOrders.status, "paid"), within(photoExtraOrders.paidAt)))
      .catch(orNone<{ paidAt: Date | null; cents: number }>("photo extras")),
    // shoots on the calendar in the period (any month, coming ones too), with what was paid for them so far
    db
      .select({
        sessionDate: bookings.sessionDate,
        totalCents,
        depositCents: sql<number>`coalesce(${bookingDeposits.amountCents}, 0)`.mapWith(Number),
        paidInFull: sql<boolean>`coalesce(${bookingPayments.status} = 'paid', false)`.mapWith(Boolean),
      })
      .from(bookings)
      .leftJoin(bookingDeposits, and(eq(bookingDeposits.bookingId, bookings.id), eq(bookingDeposits.status, "paid")))
      .leftJoin(bookingPayments, eq(bookingPayments.bookingId, bookings.id))
      .where(and(gte(bookings.sessionDate, p.from), lte(bookings.sessionDate, p.to), inArray(bookings.status, ["confirmed", "rescheduled"])))
      .catch(orNone<DashboardShootRow>("shoots")),
  ]);
  const paid = (list: { paidAt: Date | null; cents: number }[], kind: DashboardPaymentRow["kind"]): DashboardPaymentRow[] =>
    list.flatMap((r) => (r.paidAt ? [{ paidAt: r.paidAt, cents: r.cents, kind }] : []));
  const payments = [...paid(sessionPaid, "session"), ...paid(depositsKept, "deposit"), ...paid(dueDeposits, "deposit"), ...paid(extras, "extras")];
  const summary = summarizePeriod({ bookings: rows as DashboardBookingRow[], requests, payments, shoots }, p, unit, timeZone);
  const emailsWith = (status: string) => Number(emailRows.find((r) => r.status === status)?.n ?? 0);
  return {
    today,
    upcoming: upcoming.map((s) => ({
      reference: s.reference,
      date: s.date,
      start: hhmm(s.start, timeZone),
      end: hhmm(s.end, timeZone),
      parentName: s.parentName,
      bundleName: s.bundleName,
      location: s.location,
      status: s.status as DashboardSession["status"],
    })),
    period: { ...p, unit },
    totals: summary.totals,
    buckets: summary.buckets,
    bundles: summary.bundles,
    sources: summary.sources,
    changes: { cancelled: summary.cancelled, depositNotPaid: summary.depositNotPaid, rescheduled: Number(reschedules?.n ?? 0) },
    emails: { sent: emailsWith("sent"), failed: emailsWith("failed"), problems: Number(problems?.n ?? 0) },
  };
}
