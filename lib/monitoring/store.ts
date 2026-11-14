import "server-only";
import { desc, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { systemEvents } from "@/lib/db/schema";
import type { LoggedEvent, Severity } from "./events";

/** The failure log table (migration 0036). Callers handle errors: a missing row must never break what failed. */

export async function insertEvent(e: { area: string; severity: Severity; message: string; ref: string | null }): Promise<string> {
  const [row] = await getDb().insert(systemEvents).values(e).returning({ id: systemEvents.id });
  return row.id;
}

/**
 * Makes row `id` its area's alert unless an alert went out after `since`, in one statement (two failures at the same
 * moment send one email). true = send it.
 */
export async function claimAlert(id: string, area: string, since: Date): Promise<boolean> {
  const res = await getDb().execute(sql`
    UPDATE system_events SET alerted_at = now()
    WHERE id = ${id}
      AND NOT EXISTS (SELECT 1 FROM system_events p WHERE p.area = ${area} AND p.alerted_at > ${since.toISOString()}::timestamptz)
    RETURNING id`);
  return res.rows.length > 0;
}

export async function eventsSince(since: Date): Promise<LoggedEvent[]> {
  return getDb()
    .select({ at: systemEvents.at, area: systemEvents.area, severity: systemEvents.severity, message: systemEvents.message, ref: systemEvents.ref })
    .from(systemEvents)
    .where(gte(systemEvents.at, since))
    .orderBy(desc(systemEvents.at))
    .limit(500);
}

export async function purgeBefore(before: Date): Promise<void> {
  await getDb().delete(systemEvents).where(lt(systemEvents.at, before));
}
