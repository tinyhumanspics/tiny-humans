import "server-only";
import { sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import type { FunnelStep } from "@/config/funnel";
import { todayInZone } from "@/lib/booking/timezone";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { funnelCounts } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { getCatalog } from "@/lib/pricing/server";
import { decodeAttribution, sourceLabel } from "@/lib/tracking/attribution";

/** +1 for a /book step (POST /api/booking/funnel, or "request_sent" on the server). Anonymous. Best effort: never throws. */
export async function countFunnelStep(step: FunnelStep, bundleId: string, sourceCookie: string | undefined, now = new Date()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const bundle = (await getCatalog().catch(() => [])).find((b) => b.id === bundleId);
    await getDb()
      .insert(funnelCounts)
      .values({ day: todayInZone(bookingRules.timeZone, now), step, bundleId: bundle ? bundle.id : "other", source: sourceLabel(decodeAttribution(sourceCookie)).slice(0, 80), count: 1 })
      .onConflictDoUpdate({ target: [funnelCounts.day, funnelCounts.step, funnelCounts.bundleId, funnelCounts.source], set: { count: sql`${funnelCounts.count} + 1` } });
  } catch (err) {
    log.error("funnel", "Step not counted", { error: err as Error });
  }
}
