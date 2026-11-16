import "server-only";
import { and, eq, gt, gte, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { bookingRequests, bookings, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { roadMiles, travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import { homeOf } from "./details";
import { addDaysKey } from "./timezone";
import { tripLimit, withinTripLimit, type PlacedSession, type TripReason, type TripVisitor } from "./trips";
import type { DayAvailability } from "./types";

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/**
 * The sessions around a date range that trip days look at (a day either side): active bookings, and new requests that
 * still hold their time (an Orlando request makes the day an Orlando day until the owner answers or the hold ends).
 * `excludeBookingId`: a booking being moved never limits itself.
 */
export async function tripSessions(fromDate: string, toDate: string, excludeBookingId?: string, now = new Date()): Promise<PlacedSession[]> {
  if (!isDatabaseConfigured()) return [];
  const from = addDaysKey(fromDate, -1);
  const to = addDaysKey(toDate, 1);
  const where = [ne(bookings.status, "cancelled"), gte(bookings.sessionDate, from), lte(bookings.sessionDate, to)];
  if (excludeBookingId) where.push(ne(bookings.id, excludeBookingId));
  const db = getDb();
  const [booked, held] = await Promise.all([
    db
      .select({ date: bookings.sessionDate, start: bookings.sessionStart, tz: bookings.timezone, miles: bookings.travelMiles, address: bookings.locationAddress })
      .from(bookings)
      .where(and(...where)),
    db
      .select({ date: bookingRequests.slotDate, start: bookingRequests.slotStart, zip: bookingRequests.zip, miles: bookingRequests.travelMiles })
      .from(bookingRequests)
      .where(and(eq(bookingRequests.status, "new"), eq(bookingRequests.type, "date"), gte(bookingRequests.slotDate, from), lte(bookingRequests.slotDate, to), gt(bookingRequests.holdUntil, now)))
      .catch((err) => {
        if (!isUndefinedTable(err)) log.error("trips", "Request holds not read for trip days", { error: err as Error });
        return [];
      }),
  ]);
  return [
    ...booked.map((r) => ({ date: r.date, start: localTime(r.start, r.tz || bookingRules.timeZone), zip: homeOf(r.address).zip || null, miles: r.miles })),
    ...held.filter((r) => r.date && r.start).map((r) => ({ date: r.date!, start: r.start!, zip: r.zip, miles: r.miles })),
  ];
}

/** A family by ZIP code: its road miles from the home base (null when unknown: treated as close to home). */
export async function visitorForZip(zip: string | null | undefined): Promise<TripVisitor> {
  const clean = zip?.trim().slice(0, 5) ?? "";
  if (!/^\d{5}$/.test(clean)) return { zip: null, miles: null };
  return { zip: clean, miles: travelQuote(clean, await getTravelSettings()).miles };
}

/** A booked family (rescheduling): the miles saved with the booking and its home's ZIP code. */
export const visitorForBooking = (row: Pick<Booking, "travelMiles" | "locationAddress">): TripVisitor => ({ zip: homeOf(row.locationAddress).zip || null, miles: row.travelMiles });

/** The calendar for this family: the days and times trip days leave open. */
export function applyTrips(days: DayAvailability[], visitor: TripVisitor, sessions: PlacedSession[]): DayAvailability[] {
  return days.map((day) => ({ ...day, slots: withinTripLimit(day.slots, tripLimit(day.date, visitor, sessions, roadMiles)) }));
}

/** Why this family can't have this start (trip days), or null. The server's re-check before saving or moving. */
export function tripConflict(date: string, start: string, visitor: TripVisitor, sessions: PlacedSession[]): TripReason | "next_morning" | null {
  const limit = tripLimit(date, visitor, sessions, roadMiles);
  if (limit.closed) return limit.closed;
  return limit.notBefore && start < limit.notBefore ? "next_morning" : null;
}
