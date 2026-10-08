import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { travelSettingsTable } from "@/lib/db/schema";
import { log } from "@/lib/log";
import type { TravelSettings } from "./types";

/** The owner's travel fee settings, or null when they aren't saved yet (fees off) or the table is missing. */
export async function getTravelSettings(): Promise<TravelSettings | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb().select().from(travelSettingsTable).where(eq(travelSettingsTable.id, 1)).limit(1);
    return row ? { baseZip: row.baseZip, freeMiles: row.freeMiles, perMileCents: row.perMileCents, maxMiles: row.maxMiles } : null;
  } catch (err) {
    log.error("travel", "Could not load travel settings (travel fees off)", { error: err as Error });
    return null;
  }
}

export async function saveTravelSettings(s: TravelSettings): Promise<void> {
  const values = { ...s, updatedAt: new Date() };
  await getDb()
    .insert(travelSettingsTable)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: travelSettingsTable.id, set: values });
}
