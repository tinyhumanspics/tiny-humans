import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type Column } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { addDaysKey, todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import { getDb, isMissingTable } from "@/lib/db/client";
import { bookingDeposits, bookingEmails, bookingPayments, bookingRequests, bookingRescheduleHistory, bookings, dueDateReservations, emailEvents, photoExtraOrders } from "@/lib/db/schema";
import { emailNameOf } from "@/lib/email/delivery";
import { emailConfig } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { waiversForBookings } from "@/lib/waiver/server";
import { monthOf, unitFor, type DashboardPeriod } from "./dashboard-period";
import type { Dashboard, DashboardEmailProblem, DashboardSession } from "./dashboard-types";
import { problemRows, summarizePeriod, type DashboardBookingRow, type DashboardEmailEventRow, type DashboardPaymentRow, type DashboardRequestRow, type DashboardShootRow } from "./dashboard-summary";

/** Today plus the next six days. */
const UPCOMING_DAYS = 7;

const hhmm = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

/** A table added by a later migration reads as empty until it exists; any other failure is logged and reads as empty. */
const orNone = <T,>(what: string) => (err: unknown): T[] => {
  if (!isMissingTable(err)) log.error("dashboard", `Could not load ${what}`, { error: err as Error });
  return [];
};

/** The period's delivery problems (newest 20) with who they were about (owner, Nov 26: "check for who it was"). */
async function emailProblemsIn(where: ReturnType<typeof and>): Promise<DashboardEmailProblem[]> {
  const db = getDb();
  const events: DashboardEmailEventRow[] = await db
    .select({ occurredAt: emailEvents.occurredAt, type: emailEvents.type, recipient: emailEvents.recipient, bookingReference: emailEvents.bookingReference, category: emailEvents.category, detail: emailEvents.detail })
    .from(emailEvents)
    .where(where)
    .orderBy(desc(emailEvents.occurredAt))
    .limit(20);
  if (!events.length) return [];
  const emails = [...new Set(events.map((e) => e.recipient.trim().toLowerCase()))];
  const [people, requests] = await Promise.all([
    db
      .select({ email: bookings.email, name: bookings.parentName, reference: bookings.bookingReference, createdAt: bookings.createdAt })
      .from(bookings)
      .where(inArray(sql`lower(${bookings.email})`, emails)),
    db
      .select({ email: bookingRequests.email, firstName: bookingRequests.firstName, createdAt: bookingRequests.createdAt })
      .from(bookingRequests)
      .where(inArray(sql`lower(${bookingRequests.email})`, emails))
      .catch(orNone<{ email: string; firstName: string; createdAt: Date }>("requests for email problems")),
  ]);
  return problemRows(events, { bookings: people, requests }, emailConfig().notify, emailNameOf);
}

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
  const [rows, upcoming, [reschedules], emailRows, [problems], requests, sessionPaid, depositsKept, dueDeposits, extras, shoots, emailProblems] = await Promise.all([
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
        id: bookings.id,
        reference: bookings.bookingReference,
        date: bookings.sessionDate,
        start: bookings.sessionStart,
        end: bookings.sessionEnd,
        parentName: bookings.parentName,
        bundleName: bookings.packageName,
        location: bookings.locationAddress,
        status: bookings.status,
        phone: bookings.phone,
        email: bookings.email,
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
    // leads: requests from /book and booking links (migration 0037), sent in the period or asking for a day in it
    db
      .select({
        createdAt: bookingRequests.createdAt,
        wantedDate: sql<string | null>`to_char(coalesce(${bookingRequests.slotDate}, ${bookingRequests.dueDate}), 'YYYY-MM-DD')`,
        mobile: bookingRequests.mobile,
        email: bookingRequests.email,
        status: bookingRequests.status,
      })
      .from(bookingRequests)
      .where(or(within(bookingRequests.createdAt), and(gte(sql`coalesce(${bookingRequests.slotDate}, ${bookingRequests.dueDate})`, p.from), lte(sql`coalesce(${bookingRequests.slotDate}, ${bookingRequests.dueDate})`, p.to))))
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
    emailProblemsIn(within(emailEvents.occurredAt)).catch(orNone<DashboardEmailProblem>("email problems")),
  ]);
  const paid = (list: { paidAt: Date | null; cents: number }[], kind: DashboardPaymentRow["kind"]): DashboardPaymentRow[] =>
    list.flatMap((r) => (r.paidAt ? [{ paidAt: r.paidAt, cents: r.cents, kind }] : []));
  const payments = [...paid(sessionPaid, "session"), ...paid(depositsKept, "deposit"), ...paid(dueDeposits, "deposit"), ...paid(extras, "extras")];
  const waivers = await waiversForBookings(upcoming.map((s) => s.id));
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
      phone: s.phone,
      email: s.email,
      waiver: ((w) => (w?.status === "signed" ? { id: w.id, family: w.kind === "family" } : null))(waivers.get(s.id)),
    })),
    period: { ...p, unit },
    totals: summary.totals,
    leadMonths: summary.leadMonths,
    buckets: summary.buckets,
    bundles: summary.bundles,
    sources: summary.sources,
    changes: { cancelled: summary.cancelled, depositNotPaid: summary.depositNotPaid, rescheduled: Number(reschedules?.n ?? 0) },
    emails: { sent: emailsWith("sent"), failed: emailsWith("failed"), problems: Number(problems?.n ?? 0) },
    emailProblems,
  };
}
