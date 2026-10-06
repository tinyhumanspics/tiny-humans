import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { availabilityBlocks, availabilityOverrides, availabilityWeekly, bookingSettingsTable } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { addDaysKey, todayInZone } from "@/lib/booking/timezone";
import { completeWeekly, defaultAvailabilityRules, hhmm } from "./defaults";
import type { AvailabilityRules, BookingLimits, DateOverride, TimeBlock, WeeklyDay } from "./types";

/** Postgres "relation does not exist": the availability migration hasn't been run yet. */
function isMissingTable(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if ((e as { code?: string }).code === "42P01") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The owner's availability rules (weekly hours, limits, upcoming special
 * dates and time blocks). Without a database, or before the migration has
 * been run, the defaults from config/booking.ts apply. Any other database
 * error is thrown, so customers never see times that might be wrong.
 */
export async function getAvailabilityRules(): Promise<AvailabilityRules> {
  if (!isDatabaseConfigured()) return defaultAvailabilityRules();
  const db = getDb();
  const since = addDaysKey(todayInZone(bookingRules.timeZone), -1);
  try {
    const [weekly, settings, overrides, blocks] = await Promise.all([
      db.select().from(availabilityWeekly),
      db.select().from(bookingSettingsTable).where(eq(bookingSettingsTable.id, 1)),
      db.select().from(availabilityOverrides).where(gte(availabilityOverrides.date, since)).orderBy(asc(availabilityOverrides.date)),
      db.select().from(availabilityBlocks).where(gte(availabilityBlocks.date, since)).orderBy(asc(availabilityBlocks.date), asc(availabilityBlocks.startTime)),
    ]);
    const d = defaultAvailabilityRules();
    const s = settings[0];
    return {
      weekly: completeWeekly(weekly.map((w) => ({ weekday: w.weekday, isOpen: w.isOpen, start: hhmm(w.startTime)!, end: hhmm(w.endTime)! }))),
      limits: s ? { minimumNoticeDays: s.minimumNoticeDays, bookingWindowDays: s.bookingWindowDays, bufferMinutes: s.bufferMinutes } : d.limits,
      overrides: overrides.map((o) => ({ date: o.date, isClosed: o.isClosed, start: hhmm(o.startTime), end: hhmm(o.endTime) })),
      blocks: blocks.map((b) => ({ id: b.id, date: b.date, start: hhmm(b.startTime)!, end: hhmm(b.endTime)!, reason: b.reason ?? undefined })),
    };
  } catch (err) {
    if (isMissingTable(err)) {
      log.warn("availability", "Availability tables not found: using defaults. Run drizzle/0001_owner_availability.sql in Neon.");
      return defaultAvailabilityRules();
    }
    log.error("availability.db", "Could not load availability rules", { error: err as Error });
    throw err;
  }
}

export async function saveWeeklyAndLimits(weekly: WeeklyDay[], limits: BookingLimits): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(availabilityWeekly)
    .values(weekly.map((w) => ({ weekday: w.weekday, isOpen: w.isOpen, startTime: w.start, endTime: w.end, updatedAt: now })))
    .onConflictDoUpdate({
      target: availabilityWeekly.weekday,
      set: { isOpen: sql`excluded.is_open`, startTime: sql`excluded.start_time`, endTime: sql`excluded.end_time`, updatedAt: now },
    });
  await db
    .insert(bookingSettingsTable)
    .values({ id: 1, ...limits, updatedAt: now })
    .onConflictDoUpdate({ target: bookingSettingsTable.id, set: { ...limits, updatedAt: now } });
}

export async function upsertOverride(o: DateOverride): Promise<void> {
  const values = { date: o.date, isClosed: o.isClosed, startTime: o.isClosed ? null : o.start!, endTime: o.isClosed ? null : o.end!, updatedAt: new Date() };
  await getDb()
    .insert(availabilityOverrides)
    .values(values)
    .onConflictDoUpdate({ target: availabilityOverrides.date, set: { isClosed: values.isClosed, startTime: values.startTime, endTime: values.endTime, updatedAt: values.updatedAt } });
}

export async function deleteOverride(date: string): Promise<void> {
  await getDb().delete(availabilityOverrides).where(eq(availabilityOverrides.date, date));
}

export async function addBlock(b: Omit<TimeBlock, "id">): Promise<TimeBlock> {
  const [row] = await getDb()
    .insert(availabilityBlocks)
    .values({ date: b.date, startTime: b.start, endTime: b.end, reason: b.reason || null })
    .returning();
  return { id: row.id, date: row.date, start: hhmm(row.startTime)!, end: hhmm(row.endTime)!, reason: row.reason ?? undefined };
}

export async function deleteBlock(id: string): Promise<void> {
  await getDb().delete(availabilityBlocks).where(and(eq(availabilityBlocks.id, id)));
}
