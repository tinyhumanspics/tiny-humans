import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, or, type SQL } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { bookingRequests, bookings, dueDateReservations, type BookingRequestRow } from "@/lib/db/schema";
import { addDaysKey } from "@/lib/booking/timezone";
import { log } from "@/lib/log";
import type { HoldRow } from "./holds";

export type NewRequestRow = Omit<typeof bookingRequests.$inferInsert, "id" | "createdAt" | "updatedAt">;

/**
 * Where requests are kept: the database (migration 0037). Without one (local mock mode, CI) they live in this server's
 * memory, like the mock provider's bookings; production never runs without the database.
 */
function inMemory(): BookingRequestRow[] | null {
  if (isDatabaseConfigured()) return null;
  if (process.env.VERCEL_ENV === "production") throw new Error("Booking requests need the database");
  const g = globalThis as { __thBookingRequests?: BookingRequestRow[] };
  return (g.__thBookingRequests ??= []);
}

export async function findByClientId(clientId: string): Promise<BookingRequestRow | null> {
  const mem = inMemory();
  if (mem) return mem.find((r) => r.clientId === clientId) ?? null;
  const [row] = await getDb().select().from(bookingRequests).where(eq(bookingRequests.clientId, clientId)).limit(1);
  return row ?? null;
}

export async function insertRequest(values: NewRequestRow, now = new Date()): Promise<BookingRequestRow> {
  const mem = inMemory();
  if (mem) {
    const row = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "new",
      locale: "en",
      babyCount: 1,
      addonsCents: 0,
      slotDate: null,
      slotStart: null,
      startsAt: null,
      endsAt: null,
      dueDate: null,
      holdUntil: null,
      travelStatus: null,
      travelMiles: null,
      travelFeeCents: 0,
      textConsent: false,
      consentVersion: null,
      bookingId: null,
      dueId: null,
      inspirationId: null,
      ...values,
    } as BookingRequestRow;
    mem.push(row);
    return row;
  }
  const [row] = await getDb().insert(bookingRequests).values({ ...values, createdAt: now, updatedAt: now }).returning();
  return row;
}

/** Requests that may still hold a time in these days (the caller keeps the ones whose hold hasn't lapsed). */
export async function holdsBetween(fromDate: string, toDate: string, now = new Date()): Promise<HoldRow[]> {
  const from = addDaysKey(fromDate, -1);
  const to = addDaysKey(toDate, 1);
  try {
    const mem = inMemory();
    if (mem) return mem.filter((r) => r.type === "date" && r.status === "new" && r.slotDate && r.slotDate >= from && r.slotDate <= to);
    return await getDb()
      .select({ type: bookingRequests.type, status: bookingRequests.status, startsAt: bookingRequests.startsAt, endsAt: bookingRequests.endsAt, holdUntil: bookingRequests.holdUntil })
      .from(bookingRequests)
      .where(and(eq(bookingRequests.status, "new"), eq(bookingRequests.type, "date"), gte(bookingRequests.slotDate, from), lte(bookingRequests.slotDate, to), gt(bookingRequests.holdUntil, now)));
  } catch (err) {
    // the calendar must keep working (a missing table before its migration, a database hiccup)
    if (!isUndefinedTable(err)) log.error("requests", "Request holds not read", { error: err as Error });
    return [];
  }
}

/* ---------------- the owner's list (/admin → Requests) ---------------- */

/** A claim ("Confirm" pressed) that never finished, e.g. a crash: after this long the request can be confirmed again. */
const CLAIM_MS = 2 * 60_000;

/** Newest first. */
export async function listRequests(limit = 200): Promise<BookingRequestRow[]> {
  const mem = inMemory();
  if (mem) return [...mem].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  return getDb().select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt)).limit(limit);
}

export async function requestById(id: string): Promise<BookingRequestRow | null> {
  const mem = inMemory();
  if (mem) return mem.find((r) => r.id === id) ?? null;
  const [row] = await getDb().select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  return row ?? null;
}

/** One guarded update: `when` decides in memory, `where` in the database. Returns the updated row (null = not changed). */
async function change(id: string, set: Partial<BookingRequestRow>, when: (r: BookingRequestRow) => boolean, where: SQL | undefined, now = new Date()): Promise<BookingRequestRow | null> {
  const mem = inMemory();
  if (mem) {
    const row = mem.find((r) => r.id === id && when(r));
    if (!row) return null;
    Object.assign(row, set, { updatedAt: now });
    return row;
  }
  const [row] = await getDb()
    .update(bookingRequests)
    .set({ ...set, updatedAt: now })
    .where(and(eq(bookingRequests.id, id), where))
    .returning();
  return row ?? null;
}

/** Nothing made from it yet (a day-and-time request's due_id is where it came from, not something made from it). */
const unlinked = (r: BookingRequestRow) => !r.bookingId && (r.type === "date" || !r.dueId);
const unlinkedSql = () => and(isNull(bookingRequests.bookingId), or(eq(bookingRequests.type, "date"), isNull(bookingRequests.dueId)));

/**
 * "Confirm" pressed: new → confirmed before the booking is made, so the request's own hold no longer blocks its time
 * and a second tap can't book twice. Null when it isn't new (or a claim is still running).
 */
export function claimRequest(id: string, now = new Date()): Promise<BookingRequestRow | null> {
  const stale = new Date(now.getTime() - CLAIM_MS);
  return change(
    id,
    { status: "confirmed" },
    (r) => r.status === "new" || (r.status === "confirmed" && unlinked(r) && r.updatedAt < stale),
    or(eq(bookingRequests.status, "new"), and(eq(bookingRequests.status, "confirmed"), unlinkedSql(), lt(bookingRequests.updatedAt, stale))),
    now,
  );
}

/** The booking failed: back to new (its hold counts again until it lapses). */
export async function unclaimRequest(id: string): Promise<void> {
  await change(id, { status: "new" }, (r) => r.status === "confirmed" && unlinked(r), and(eq(bookingRequests.status, "confirmed"), unlinkedSql())).catch((err) =>
    log.error("requests", "Request not given back after a failed confirm", { error: err as Error }),
  );
}

/** The booking or reservation made from it: confirmed (waiting on the deposit) or booked (nothing to pay). */
export function linkRequest(id: string, link: { bookingId?: string; dueId?: string }, status: "confirmed" | "booked"): Promise<BookingRequestRow | null> {
  return change(id, { status, ...(link.bookingId ? { bookingId: link.bookingId } : {}), ...(link.dueId ? { dueId: link.dueId } : {}) }, (r) => r.status === "confirmed", eq(bookingRequests.status, "confirmed"));
}

/** "Decline": a new request (or a claim that never finished) ends, and its hold with it. */
export function declineRequest(id: string): Promise<BookingRequestRow | null> {
  return change(
    id,
    { status: "declined" },
    (r) => r.status === "new" || (r.status === "confirmed" && unlinked(r)),
    or(eq(bookingRequests.status, "new"), and(eq(bookingRequests.status, "confirmed"), unlinkedSql())),
  );
}

/** "Delete" (owner, Nov 14: tests): gone for good, and its hold with it. A booking or reservation made from it stays. */
export async function deleteRequest(id: string): Promise<boolean> {
  const mem = inMemory();
  if (mem) {
    const i = mem.findIndex((r) => r.id === id);
    if (i >= 0) mem.splice(i, 1);
    return i >= 0;
  }
  const gone = await getDb().delete(bookingRequests).where(eq(bookingRequests.id, id)).returning({ id: bookingRequests.id });
  return gone.length > 0;
}

/**
 * The deposit was paid (or nothing was owed): the request made from this booking or reservation is booked. Best
 * effort: never fails the payment it follows.
 */
export async function markRequestBooked(link: { bookingId: string } | { dueId: string }): Promise<void> {
  try {
    const mem = inMemory();
    const match = (r: BookingRequestRow) => r.status === "confirmed" && ("bookingId" in link ? r.bookingId === link.bookingId : r.dueId === link.dueId);
    if (mem) {
      for (const r of mem.filter(match)) Object.assign(r, { status: "booked", updatedAt: new Date() });
      return;
    }
    await getDb()
      .update(bookingRequests)
      .set({ status: "booked", updatedAt: new Date() })
      .where(and(eq(bookingRequests.status, "confirmed"), "bookingId" in link ? eq(bookingRequests.bookingId, link.bookingId) : eq(bookingRequests.dueId, link.dueId)));
  } catch (err) {
    if (!isUndefinedTable(err)) log.error("requests", "Request not marked booked (the booking itself is fine)", { error: err as Error });
  }
}

/** What was made from each request, for the list: booking id → reference + day + start (Miami time); due id → reference. */
export async function madeFor(rows: BookingRequestRow[]): Promise<{ bookings: Map<string, { reference: string; date: string; start: string }>; dues: Map<string, { reference: string }> }> {
  const bookingIds = rows.map((r) => r.bookingId).filter((v): v is string => Boolean(v));
  const dueIds = rows.map((r) => r.dueId).filter((v): v is string => Boolean(v));
  if (inMemory() || (!bookingIds.length && !dueIds.length)) return { bookings: new Map(), dues: new Map() };
  const db = getDb();
  const [b, d] = await Promise.all([
    bookingIds.length ? db.select({ id: bookings.id, reference: bookings.bookingReference, date: bookings.sessionDate, startsAt: bookings.sessionStart, tz: bookings.timezone }).from(bookings).where(inArray(bookings.id, bookingIds)) : [],
    dueIds.length ? db.select({ id: dueDateReservations.id, reference: dueDateReservations.reference }).from(dueDateReservations).where(inArray(dueDateReservations.id, dueIds)) : [],
  ]);
  const hhmm = (at: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return {
    bookings: new Map(b.map((x) => [x.id, { reference: x.reference, date: x.date, start: hhmm(x.startsAt, x.tz) }])),
    dues: new Map(d.map((x) => [x.id, { reference: x.reference }])),
  };
}
