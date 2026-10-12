import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { adminAuth } from "@/lib/db/schema";
import { log } from "@/lib/log";

/**
 * The owner's current session epoch (admin_auth row 1). 0 without a database or before migration 0020.
 * On any other database error it also answers 0 (and logs): a database outage shouldn't lock the owner out of the
 * theme and photo settings. The risk is small: it needs a stolen cookie from before "Sign out all other devices"
 * AND a database outage at the same time.
 */
export async function currentSessionEpoch(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const [row] = await getDb().select({ epoch: adminAuth.sessionEpoch }).from(adminAuth).where(eq(adminAuth.id, 1)).limit(1);
    return row?.epoch ?? 0;
  } catch (err) {
    if (!isUndefinedTable(err)) log.error("admin.session", "Could not read the session epoch", { error: err as Error });
    return 0;
  }
}

/** "Sign out all other devices": raises the epoch and returns the new one (throws before migration 0020). */
export async function bumpSessionEpoch(): Promise<number> {
  const [row] = await getDb()
    .insert(adminAuth)
    .values({ id: 1, sessionEpoch: 1 })
    .onConflictDoUpdate({ target: adminAuth.id, set: { sessionEpoch: sql`${adminAuth.sessionEpoch} + 1`, updatedAt: new Date() } })
    .returning({ epoch: adminAuth.sessionEpoch });
  return row.epoch;
}
