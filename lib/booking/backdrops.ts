import "server-only";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingBackdrops, type BookingBackdrops } from "@/lib/db/schema";
import { log } from "@/lib/log";

/** A failed query's message repeats its values, so only the database's own reason is logged. */
const reason = (err: unknown) => new Error((err as { cause?: Error }).cause?.message ?? "query failed");

/** Saves the family's picks (replacing earlier ones). Throws on failure; the booking form's save is best effort. */
export async function saveBackdrops(bookingId: string, picks: string[], source: "booking" | "family"): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(bookingBackdrops)
    .values({ bookingId, picks, source, updatedAt: now })
    .onConflictDoUpdate({ target: bookingBackdrops.bookingId, set: { picks: sql`excluded.picks`, source, updatedAt: now } });
}

/** Picks made on the booking form (best effort: the booking is confirmed either way, and they're in the event + emails). */
export async function saveBookingBackdrops(bookingId: string, picks: string[] | undefined, reference: string): Promise<void> {
  if (!picks?.length) return;
  await saveBackdrops(bookingId, picks, "booking").catch((err) => log.error("booking.db", "Backdrop picks not saved", { reference, error: reason(err) }));
}

/** Picks of these bookings (empty if the table isn't there yet). */
export async function backdropsFor(bookingIds: string[]): Promise<BookingBackdrops[]> {
  if (!bookingIds.length) return [];
  return getDb()
    .select()
    .from(bookingBackdrops)
    .where(inArray(bookingBackdrops.bookingId, bookingIds))
    .catch((err) => {
      log.error("booking.db", "Could not load backdrop picks", { error: reason(err) });
      return [];
    });
}
