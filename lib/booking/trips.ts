import { tripDays } from "@/config/booking";
import { addDaysKey } from "./timezone";

/**
 * Trip days (config/booking.ts `tripDays`): what a far session does to the days around it. Pure, so it's unit tested;
 * lib/booking/trips-server.ts feeds it the sessions on the calendar.
 */
export type TripRules = { tripMiles: number; sameTripMiles: number; nextDayUntil: string };

/** A session on the calendar (a booking, or a request still holding its time): its day, local start, ZIP and miles. */
export interface PlacedSession {
  date: string;
  start: string;
  zip: string | null;
  miles: number | null;
}

/** The family looking for a time (null miles = unknown: treated as close to home). */
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

/** 70 miles and above (owner, Nov 16). */
const isTrip = (miles: number | null, s: TripRules) => miles !== null && miles >= s.tripMiles;

export function tripLimit(date: string, visitor: TripVisitor, sessions: PlacedSession[], distance: (a: string, b: string) => number | null, s: TripRules = tripDays): TripLimit {
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
