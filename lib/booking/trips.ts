import { addDaysKey } from "./timezone";

/**
 * Trip days (owner, Nov 10): a session farther than `tripMiles` from the home base (Orlando is ~4 hours away) takes the
 * whole day. That day only families within `sameTripMiles` of the trip can book; a far family can't take a day that
 * already has local sessions; and the next morning stays free until `nextDayUntil` (the drive back). Local and mid
 * distances work as before (the 2-hour buffer between sessions covers the drives). Pure, so it's unit tested.
 */
export interface TripSettings {
  enabled: boolean;
  /** Road miles from the home base above which a session makes the day a trip day. */
  tripMiles: number;
  /** Families this close (road miles) to a trip day's session can share that day. */
  sameTripMiles: number;
  /** After a trip day, nothing starts before this time ("HH:MM", Miami time). */
  nextDayUntil: string;
}

/** The owner's choices (Nov 10): more than 60 miles, within 30 miles of the trip, next day from 12 PM. */
export const DEFAULT_TRIP_SETTINGS: TripSettings = { enabled: true, tripMiles: 60, sameTripMiles: 30, nextDayUntil: "12:00" };

/** An active session on the calendar: its day, local start, the home's ZIP code and its road miles from the base. */
export interface PlacedSession {
  date: string;
  start: string;
  zip: string | null;
  miles: number | null;
}

/** The family looking for a time (null miles = unknown: treated as local). */
export interface TripVisitor {
  zip: string | null;
  miles: number | null;
}

export type TripReason = "trip_elsewhere" | "local_day" | "next_morning_busy";

/** What trip days allow on `date` for this family: closed for them, or open only from a time on (the morning after a trip). */
export interface TripLimit {
  closed: TripReason | null;
  /** Earliest start ("HH:MM") because the day before is a trip day, else null. */
  notBefore: string | null;
}

const isTrip = (miles: number | null, s: TripSettings) => miles !== null && miles > s.tripMiles;

export function tripLimit(date: string, visitor: TripVisitor, sessions: PlacedSession[], s: TripSettings, distance: (a: string, b: string) => number | null): TripLimit {
  if (!s.enabled) return { closed: null, notBefore: null };
  const sameDay = sessions.filter((x) => x.date === date);
  const visitorTrip = isTrip(visitor.miles, s);
  const near = (x: PlacedSession) => {
    if (!visitor.zip || !x.zip) return false;
    const d = distance(visitor.zip, x.zip);
    return d !== null && d <= s.sameTripMiles;
  };
  const trips = sameDay.filter((x) => isTrip(x.miles, s));
  let closed: TripReason | null = null;
  // a trip day: only families near that trip
  if (trips.length && !trips.every(near)) closed = "trip_elsewhere";
  // a far family can't take a day that already has sessions back home
  else if (visitorTrip && sameDay.some((x) => !isTrip(x.miles, s))) closed = "local_day";
  // a far family can't take a day whose next morning (the drive back) is already booked
  else if (visitorTrip && sessions.some((x) => x.date === addDaysKey(date, 1) && x.start < s.nextDayUntil)) closed = "next_morning_busy";
  const dayBeforeIsTrip = sessions.some((x) => x.date === addDaysKey(date, -1) && isTrip(x.miles, s));
  return { closed, notBefore: dayBeforeIsTrip ? s.nextDayUntil : null };
}

/** Applies a trip limit to a day's open times. */
export function withinTripLimit<T extends { start: string }>(slots: T[], limit: TripLimit): T[] {
  if (limit.closed) return [];
  return limit.notBefore ? slots.filter((slot) => slot.start >= limit.notBefore!) : slots;
}

/** The ZIP code at the end of a saved address ("…, Miami Beach, FL 33139" → 33139), else null. */
export function zipOfAddress(address: string | null | undefined): string | null {
  const all = [...(address ?? "").matchAll(/(?<![\d-])(\d{5})(?:-\d{4})?(?![\d-])/g)];
  return all.length ? all[all.length - 1][1] : null;
}
