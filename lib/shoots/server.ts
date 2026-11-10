import "server-only";
import { and, asc, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { shootBringSections, shootInspo, shootTicks, shoots, type Shoot, type ShootInspo as InspoRow } from "@/lib/db/schema";
import { bookingShootByReference, bookingShootsBetween, bookingShootsById } from "./booking-source";
import { referenceOfKey } from "./from-bookings";
import { LIST_LIMITS } from "./lists";
import { platformOf } from "./links";
import { sunsetOn } from "./sunset";
import { bringLists, dayKeys, inspoKey, progressOf } from "./ticks";
import type { BringSection, DaySheet, InspoGroup, InspoItem, ShootBookingFacts, ShootDay, ShootDetail } from "./types";
import type { BringSectionPatch, NewInspo, NewStyledShoot, ShootPatch } from "./validation";
import { byStart, shootDetail, shootSummary, type ShootRow } from "./view";

/**
 * /admin → Shoots, database side (spec §4, §6). Every function is owner-only: API routes check `isAdmin()` and parse
 * input with lib/shoots/validation.ts first. Booking facts come from booking-source.ts; nothing here writes to the
 * booking tables. Files (photos, videos) are deleted through the `removeFiles` callback BEFORE their rows, so a failed
 * delete leaves a row to retry instead of a file nobody can find.
 */

/** Migration 0024 hasn't run (or there's no database): the Shoots pages say "Run the shoots migration". */
export class ShootsNotReadyError extends Error {
  constructor() {
    super("Run the shoots migration (drizzle/0024_shoots.sql) in Neon.");
  }
}
export class ShootNotFoundError extends Error {
  constructor(what = "That shoot doesn't exist anymore.") {
    super(what);
  }
}
/** Owner input the database can't take (shown as is). */
export class ShootInputError extends Error {}

/** Per shoot: plenty for a session, small enough that a runaway script can't fill the database. */
export const MAX_ITEMS_PER_SHOOT = 200;

export type RemoveFiles = (pathnames: string[]) => Promise<void>;

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  if (!isDatabaseConfigured()) throw new ShootsNotReadyError();
  try {
    return await fn();
  } catch (err) {
    if (isUndefinedTable(err)) throw new ShootsNotReadyError();
    throw err;
  }
}

/** A saved jsonb list (a hand-edited or malformed value reads as empty instead of breaking the day sheet). */
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const rowOf = (s: Shoot): ShootRow => ({
  id: s.id,
  kind: s.kind as ShootRow["kind"],
  date: s.date,
  startTime: s.startTime,
  place: s.place,
  title: s.title,
  tabLabel: s.tabLabel,
  said: s.said,
  confirm: listOf(s.confirm),
  bringExtra: listOf(s.bringExtra),
});

/**
 * Photos/videos are shown from their Blob address for now; slice 4 decides between Blob's private access (then this
 * becomes an owner-only route) and a public address that is never linked from public pages.
 */
const itemOf = (r: InspoRow): InspoItem => ({
  id: r.id,
  group: r.group as InspoGroup,
  type: r.type as InspoItem["type"],
  mediaUrl: r.blobUrl,
  contentType: r.contentType,
  width: r.width,
  height: r.height,
  linkUrl: r.linkUrl,
  platform: r.platform,
  caption: r.caption,
  sort: r.sort,
});

async function inspoOf(shootIds: string[]): Promise<Map<string, InspoItem[]>> {
  const out = new Map<string, InspoItem[]>();
  if (!shootIds.length) return out;
  const rows = await getDb().select().from(shootInspo).where(inArray(shootInspo.shootId, shootIds)).orderBy(asc(shootInspo.sort), asc(shootInspo.createdAt));
  for (const r of rows) out.set(r.shootId, [...(out.get(r.shootId) ?? []), itemOf(r)]);
  return out;
}

async function sectionsRaw(): Promise<BringSection[]> {
  const rows = await getDb().select().from(shootBringSections).orderBy(asc(shootBringSections.sort), asc(shootBringSections.updatedAt));
  return rows.map((r) => ({ id: r.id, name: r.name, items: listOf(r.items), sort: r.sort }));
}

/** Every shoot between two Miami days (inclusive): active bookings (with their rows once edited) + shoots without one. */
async function shootsBetween(from: string, to: string): Promise<ShootDetail[]> {
  const db = getDb();
  const [facts, styled] = await Promise.all([
    bookingShootsBetween(from, to),
    db.select().from(shoots).where(and(eq(shoots.kind, "styled"), gte(shoots.date, from), lte(shoots.date, to))),
  ]);
  const bookingRows = facts.length ? await db.select().from(shoots).where(inArray(shoots.bookingId, facts.map((f) => f.bookingId))) : [];
  const rowByBooking = new Map(bookingRows.map((r) => [r.bookingId!, r]));
  const inspo = await inspoOf([...bookingRows, ...styled].map((r) => r.id));
  return [
    ...facts.map((f) => {
      const row = rowByBooking.get(f.bookingId);
      return shootDetail(f, row ? rowOf(row) : null, row ? (inspo.get(row.id) ?? []) : []);
    }),
    ...styled.map((r) => shootDetail(null, rowOf(r), inspo.get(r.id) ?? [])),
  ];
}

/** Shoot days between two dates (GET /api/admin/shoots): cards with each shoot, sunset and tick progress. */
export async function listShootDays(from: string, to: string): Promise<ShootDay[]> {
  return guard(async () => {
    const [all, sections, ticks] = await Promise.all([
      shootsBetween(from, to),
      sectionsRaw(),
      getDb().select({ date: shootTicks.date, key: shootTicks.key }).from(shootTicks).where(and(gte(shootTicks.date, from), lte(shootTicks.date, to))),
    ]);
    const dates = [...new Set(all.map((s) => s.date))].sort();
    return dates.map((date) => {
      const day = all.filter((s) => s.date === date).sort(byStart);
      const progress = progressOf(dayKeys(date, day, sections), ticks.filter((t) => t.date === date).map((t) => t.key));
      return { date, sunset: sunsetOn(date), shoots: day.map(shootSummary), ...progress };
    });
  });
}

/** Everything a day sheet shows (GET /api/admin/shoots/day/[date]). */
export async function getDaySheet(date: string): Promise<DaySheet> {
  return guard(async () => {
    const [day, sections, ticks] = await Promise.all([shootsBetween(date, date), sectionsRaw(), getTicks(date)]);
    day.sort(byStart);
    const progress = progressOf(dayKeys(date, day, sections), ticks);
    return { date, sunset: sunsetOn(date), shoots: day, bring: bringLists(date, day, sections), ticks, ...progress };
  });
}

/** A shoot's folder by its key ("b-<reference>" or the row id); null when it doesn't exist. */
export async function getShoot(key: string): Promise<ShootDetail | null> {
  return guard(async () => {
    const db = getDb();
    const reference = referenceOfKey(key);
    if (reference) {
      const facts = await bookingShootByReference(reference);
      if (!facts) return null;
      const [row] = await db.select().from(shoots).where(eq(shoots.bookingId, facts.bookingId)).limit(1);
      return shootDetail(facts, row ? rowOf(row) : null, row ? ((await inspoOf([row.id])).get(row.id) ?? []) : []);
    }
    const [row] = await db.select().from(shoots).where(eq(shoots.id, key)).limit(1);
    if (!row) return null;
    let facts: ShootBookingFacts | null = null;
    if (row.bookingId) {
      facts = (await bookingShootsById([row.bookingId])).get(row.bookingId) ?? null;
      if (!facts) return null;
    }
    return shootDetail(facts, rowOf(row), (await inspoOf([row.id])).get(row.id) ?? []);
  });
}

/** The shoot's row, created for a booking on its first save (spec §2: "the row is created on first save"). */
async function ensureRow(key: string): Promise<Shoot> {
  const db = getDb();
  const reference = referenceOfKey(key);
  if (reference) {
    const facts = await bookingShootByReference(reference);
    if (!facts) throw new ShootNotFoundError();
    await db.insert(shoots).values({ kind: "booking", bookingId: facts.bookingId }).onConflictDoNothing({ target: shoots.bookingId });
    const [row] = await db.select().from(shoots).where(eq(shoots.bookingId, facts.bookingId)).limit(1);
    if (!row) throw new ShootNotFoundError();
    return row;
  }
  const [row] = await db.select().from(shoots).where(eq(shoots.id, key)).limit(1);
  if (!row) throw new ShootNotFoundError();
  return row;
}

/** Saves folder edits (title, tab label, what they asked for, still to confirm, bring extra; day/start/place for styled). */
export async function updateShoot(key: string, patch: ShootPatch): Promise<ShootDetail> {
  return guard(async () => {
    const row = await ensureRow(key);
    const styledOnly = patch.date !== undefined || patch.startTime !== undefined || patch.place !== undefined;
    if (row.kind === "booking" && styledOnly) throw new ShootInputError("The day and time come from the booking. Reschedule it in Leads.");
    const set: Partial<typeof shoots.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title || null;
    if (patch.tabLabel !== undefined) set.tabLabel = patch.tabLabel || null;
    if (patch.said !== undefined) set.said = patch.said;
    if (patch.confirm !== undefined) set.confirm = patch.confirm;
    if (patch.bringExtra !== undefined) set.bringExtra = patch.bringExtra;
    if (patch.date !== undefined) set.date = patch.date;
    if (patch.startTime !== undefined) set.startTime = patch.startTime;
    if (patch.place !== undefined) set.place = patch.place || null;
    await getDb().update(shoots).set(set).where(eq(shoots.id, row.id));
    const detail = await getShoot(row.id);
    if (!detail) throw new ShootNotFoundError();
    return detail;
  });
}

/** "+ Shoot without a booking". */
export async function createStyledShoot(input: NewStyledShoot): Promise<ShootDetail> {
  return guard(async () => {
    const [row] = await getDb()
      .insert(shoots)
      .values({ kind: "styled", title: input.title, date: input.date, startTime: input.startTime ?? null, place: input.place || null })
      .returning();
    return shootDetail(null, rowOf(row), []);
  });
}

/** Files of these shoots' photos/videos (Blob pathnames). */
async function filesOf(shootIds: string[]): Promise<string[]> {
  if (!shootIds.length) return [];
  const rows = await getDb().select({ pathname: shootInspo.blobPathname }).from(shootInspo).where(inArray(shootInspo.shootId, shootIds));
  return rows.map((r) => r.pathname).filter((p): p is string => Boolean(p));
}

/** Deletes a shoot without a booking, its files first (booking shoots go away with their booking). */
export async function deleteStyledShoot(id: string, removeFiles: RemoveFiles): Promise<void> {
  return guard(async () => {
    const [row] = await getDb().select().from(shoots).where(eq(shoots.id, id)).limit(1);
    if (!row) throw new ShootNotFoundError();
    if (row.kind !== "styled") throw new ShootInputError("A booking's shoot goes away when the booking is deleted in Leads.");
    const files = await filesOf([row.id]);
    if (files.length) await removeFiles(files);
    await getDb().delete(shoots).where(eq(shoots.id, row.id));
  });
}

/**
 * Before a lead is deleted: removes its shoot's files (the rows go with the booking, ON DELETE CASCADE). Best effort
 * when the Shoots tables don't exist yet (nothing to remove).
 */
export async function removeBookingShootFiles(bookingId: string, removeFiles: RemoveFiles): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const rows = await getDb().select({ id: shoots.id }).from(shoots).where(eq(shoots.bookingId, bookingId));
    const files = await filesOf(rows.map((r) => r.id));
    if (files.length) await removeFiles(files);
  } catch (err) {
    if (isUndefinedTable(err)) return;
    throw err;
  }
}

async function nextSort(shootId: string, group: InspoGroup): Promise<number> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(shootInspo).where(eq(shootInspo.shootId, shootId));
  if (count >= MAX_ITEMS_PER_SHOOT) throw new ShootInputError(`This shoot already has ${MAX_ITEMS_PER_SHOOT} items. Remove a few first.`);
  const [{ top }] = await db.select({ top: max(shootInspo.sort) }).from(shootInspo).where(and(eq(shootInspo.shootId, shootId), eq(shootInspo.group, group)));
  return (top ?? -1) + 1;
}

/** Adds a pasted link or a text-only item ("+ A shot with no photo" / "+ Write an idea"). */
export async function addInspo(key: string, input: NewInspo): Promise<InspoItem> {
  return guard(async () => {
    const row = await ensureRow(key);
    const sort = await nextSort(row.id, input.group);
    const values =
      input.type === "link"
        ? { shootId: row.id, group: input.group, type: "link", linkUrl: input.url, platform: platformOf(input.url), caption: input.caption, sort }
        : { shootId: row.id, group: input.group, type: "note", caption: input.caption, sort };
    const [created] = await getDb().insert(shootInspo).values(values).returning();
    return itemOf(created);
  });
}

/** An uploaded photo or video (slice 4: the upload route checks the file, stores it in Blob, then calls this). */
export async function addInspoFile(
  key: string,
  file: { group: InspoGroup; type: "image" | "video"; blobUrl: string; blobPathname: string; contentType: string; bytes: number; width?: number | null; height?: number | null; caption?: string },
): Promise<InspoItem> {
  return guard(async () => {
    const row = await ensureRow(key);
    const sort = await nextSort(row.id, file.group);
    const [created] = await getDb()
      .insert(shootInspo)
      .values({ shootId: row.id, group: file.group, type: file.type, blobUrl: file.blobUrl, blobPathname: file.blobPathname, contentType: file.contentType, bytes: file.bytes, width: file.width ?? null, height: file.height ?? null, caption: file.caption ?? "", sort })
      .returning();
    return itemOf(created);
  });
}

/** "What's the shot?" / "What's the idea?" */
export async function updateInspo(id: string, patch: { caption: string }): Promise<InspoItem> {
  return guard(async () => {
    const [updated] = await getDb().update(shootInspo).set({ caption: patch.caption }).where(eq(shootInspo.id, id)).returning();
    if (!updated) throw new ShootNotFoundError("That item was already removed.");
    return itemOf(updated);
  });
}

/** Removes an item: its file first, then the row and its ticks. */
export async function deleteInspo(id: string, removeFiles: RemoveFiles): Promise<void> {
  return guard(async () => {
    const db = getDb();
    const [row] = await db.select().from(shootInspo).where(eq(shootInspo.id, id)).limit(1);
    if (!row) return;
    if (row.blobPathname) await removeFiles([row.blobPathname]);
    await db.batch([db.delete(shootInspo).where(eq(shootInspo.id, id)), db.delete(shootTicks).where(eq(shootTicks.key, inspoKey(id)))]);
  });
}

/* ---------- What we always bring ---------- */

export async function listBringSections(): Promise<BringSection[]> {
  return guard(sectionsRaw);
}

/** "+ Add a section": an empty card at the end. */
export async function createBringSection(name: string): Promise<BringSection> {
  return guard(async () => {
    const db = getDb();
    const [{ count, top }] = await db.select({ count: sql<number>`count(*)::int`, top: max(shootBringSections.sort) }).from(shootBringSections);
    if (count >= LIST_LIMITS.sections) throw new ShootInputError(`You already have ${LIST_LIMITS.sections} sections.`);
    const [row] = await db.insert(shootBringSections).values({ name, items: [], sort: (top ?? -1) + 1 }).returning();
    return { id: row.id, name: row.name, items: listOf(row.items), sort: row.sort };
  });
}

export async function updateBringSection(id: string, patch: BringSectionPatch): Promise<BringSection> {
  return guard(async () => {
    const set: Partial<typeof shootBringSections.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.items !== undefined) set.items = patch.items;
    if (patch.sort !== undefined) set.sort = patch.sort;
    const [row] = await getDb().update(shootBringSections).set(set).where(eq(shootBringSections.id, id)).returning();
    if (!row) throw new ShootNotFoundError("That section was already removed.");
    return { id: row.id, name: row.name, items: listOf(row.items), sort: row.sort };
  });
}

export async function deleteBringSection(id: string): Promise<void> {
  return guard(async () => {
    await getDb().delete(shootBringSections).where(eq(shootBringSections.id, id));
  });
}

/* ---------- ticks ---------- */

export async function getTicks(date: string): Promise<string[]> {
  return guard(async () => {
    const rows = await getDb().select({ key: shootTicks.key }).from(shootTicks).where(eq(shootTicks.date, date));
    return rows.map((r) => r.key);
  });
}

/** Ticks or un-ticks one line (idempotent: both phones can send the same tick). */
export async function setTick(date: string, key: string, on: boolean): Promise<void> {
  return guard(async () => {
    const db = getDb();
    if (on) await db.insert(shootTicks).values({ date, key }).onConflictDoNothing();
    else await db.delete(shootTicks).where(and(eq(shootTicks.date, date), eq(shootTicks.key, key)));
  });
}

/** "Clear all ticks" for a day. */
export async function clearTicks(date: string): Promise<void> {
  return guard(async () => {
    await getDb().delete(shootTicks).where(eq(shootTicks.date, date));
  });
}
