import "server-only";
import { and, asc, count, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { addDaysKey, todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import { getDb } from "@/lib/db/client";
import { bookingDeposits, bookingEmails, bookingRescheduleHistory, bookings, emailEvents } from "@/lib/db/schema";
import type { Dashboard, DashboardSession } from "./dashboard-types";
import { summarizeBookings, windowStartKey, type DashboardBookingRow } from "./dashboard-summary";

/** Days of email history on the dashboard. */
export const EMAIL_DAYS = 30;
/** Today plus the next six days. */
const UPCOMING_DAYS = 7;

const hhmm = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

/** Everything the owner dashboard shows, read fresh from Neon (owner only; never cached). */
export async function getDashboard(now = new Date()): Promise<Dashboard> {
  const timeZone = bookingRules.timeZone;
  const today = todayInZone(timeZone, now);
  const since = zonedTimeToUtc(windowStartKey(today), "00:00", timeZone);
  const emailsSince = new Date(now.getTime() - EMAIL_DAYS * 86_400_000);
  const totalCents = sql<number>`coalesce(${bookings.finalPriceCents}, ${bookings.packagePrice} * 100) + coalesce(${bookings.addonsTotalCents}, 0) + coalesce(${bookings.travelFeeCents}, 0)`.mapWith(Number);
  const db = getDb();
  const [rows, upcoming, [reschedules], emailRows, [problems]] = await Promise.all([
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
      .where(or(gte(bookings.createdAt, since), gte(bookings.cancelledAt, since))),
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
    db.select({ n: count() }).from(bookingRescheduleHistory).where(gte(bookingRescheduleHistory.createdAt, since)),
    db.select({ status: bookingEmails.status, n: count() }).from(bookingEmails).where(gte(bookingEmails.createdAt, emailsSince)).groupBy(bookingEmails.status),
    db.select({ n: count() }).from(emailEvents).where(gte(emailEvents.occurredAt, emailsSince)),
  ]);
  const summary = summarizeBookings(rows as DashboardBookingRow[], today, timeZone);
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
    weeks: summary.weeks,
    bundles: summary.bundles,
    sources: summary.sources,
    changes: { cancelled: summary.cancelled, depositNotPaid: summary.depositNotPaid, rescheduled: Number(reschedules?.n ?? 0) },
    emails: { days: EMAIL_DAYS, sent: emailsWith("sent"), failed: emailsWith("failed"), problems: Number(problems?.n ?? 0) },
  };
}
