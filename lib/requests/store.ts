import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, gte, lte } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { bookingRequests, type BookingRequestRow } from "@/lib/db/schema";
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
