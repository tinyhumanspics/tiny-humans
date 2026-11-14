import "server-only";
import type { BookingRequestRow } from "@/lib/db/schema";

/**
 * Runs once when a new request is saved (brief 02), after the save and before the answer. Brief 03 adds the Meta Lead
 * event (browser + Conversions API, shared event id) and the request's attribution here.
 */
export async function onRequestCreated(row: BookingRequestRow): Promise<void> {
  void row;
}
