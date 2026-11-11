import "server-only";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { bookings, tripSettingsTable, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { roadMiles, travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import type { DayAvailability } from "./types";
import { addDaysKey } from "./timezone";
import { DEFAULT_TRIP_SETTINGS, tripLimit, withinTripLimit, zipOfAddress, type PlacedSession, type TripReason, type TripSettings, type TripVisitor } from "./trips";

const missingTable = (err: unknown) => (err as { cause?: { code?: string } })?.cause?.code === "42P01" || /does not exist/.test(String((err as Error)?.message ?? ""));
const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** The owner's trip-day rules; the Nov 10 defaults when nothing is saved (or migration 0027 hasn't run). */
export async function getTripSettings(): Promise<TripSettings> {
  if (!isDatabaseConfigured()) return DEFAULT_TRIP_SETTINGS;
  try {
    const [row] = await getDb().select().from(tripSettingsTable).where(eq(tripSettingsTable.id, 1)).limit(1);
    return row ? { enabled: row.enabled, tripMiles: row.tripMiles, sameTripMiles: row.sameTripMiles, nextDayUntil: row.nextDayUntil } : DEFAULT_TRIP_SETTINGS;
  } catch (err) {
    if (!missingTable(err)) log.error("trips", "Trip settings not loaded (defaults used)", { error: err as Error });
    return DEFAULT_TRIP_SETTINGS;
  }
}

export async function saveTripSettings(s: TripSettings): Promise<void> {
  const values = { ...s, updatedAt: new Date() };
  await getDb().insert(tripSettingsTable).values({ id: 1, ...values }).onConflictDoUpdate({ target: tripSettingsTable.id, set: values });
}

/** Everything the trip rules need for a date range: the rules and the active sessions a day around it. */
export interface TripContext {
  settings: TripSettings;
  sessions: PlacedSession[];
}

export async function tripContext(fromDate: string, toDate: string, excludeBookingId?: string): Promise<TripContext> {
  const settings = await getTripSettings();
  if (!settings.enabled || !isDatabaseConfigured()) return { settings, sessions: [] };
  const where = [ne(bookings.status, "cancelled"), gte(bookings.sessionDate, addDaysKey(fromDate, -1)), lte(bookings.sessionDate, addDaysKey(toDate, 1))];
  if (excludeBookingId) where.push(ne(bookings.id, excludeBookingId));
  const rows = await getDb()
    .select({ date: bookings.sessionDate, start: bookings.sessionStart, tz: bookings.timezone, miles: bookings.travelMiles, address: bookings.locationAddress })
    .from(bookings)
    .where(and(...where));
  return { settings, sessions: rows.map((r) => ({ date: r.date, start: localTime(r.start, r.tz || bookingRules.timeZone), zip: zipOfAddress(r.address), miles: r.miles })) };
}

/** A family by ZIP code: its road miles from the home base (null when unknown: treated as local). */
export async function visitorForZip(zip: string | null | undefined): Promise<TripVisitor> {
  const clean = zip?.trim().slice(0, 5) ?? "";
  if (!/^\d{5}$/.test(clean)) return { zip: null, miles: null };
  const quote = travelQuote(clean, await getTravelSettings());
  return { zip: clean, miles: quote.miles };
}

/** A booked family (rescheduling): the miles saved with the booking and its home's ZIP code. */
export const visitorForBooking = (row: Pick<Booking, "travelMiles" | "locationAddress">): TripVisitor => ({ zip: zipOfAddress(row.locationAddress), miles: row.travelMiles });

export const tripDistance = (a: string, b: string) => roadMiles(a, b);

/** The calendar for this family: days and times that trip days leave open. */
export function applyTrips(days: DayAvailability[], visitor: TripVisitor, ctx: TripContext): DayAvailability[] {
  if (!ctx.settings.enabled) return days;
  return days.map((day) => ({ ...day, slots: withinTripLimit(day.slots, tripLimit(day.date, visitor, ctx.sessions, ctx.settings, tripDistance)) }));
}

/** Why this family can't book this start (trip days), or null. Server re-check before saving or moving a booking. */
export function tripConflict(date: string, start: string, visitor: TripVisitor, ctx: TripContext): TripReason | "next_morning" | null {
  if (!ctx.settings.enabled) return null;
  const limit = tripLimit(date, visitor, ctx.sessions, ctx.settings, tripDistance);
  if (limit.closed) return limit.closed;
  return limit.notBefore && start < limit.notBefore ? "next_morning" : null;
}
