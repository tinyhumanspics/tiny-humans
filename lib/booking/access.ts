import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingAccess, type BookingAccess } from "@/lib/db/schema";
import { log } from "@/lib/log";

/** Preserve safe driver metadata for the logger; it discards the value-filled Drizzle message. */
const reason = (err: unknown) => (err instanceof Error ? err : new Error("query failed"));

/**
 * Gate code / parking / concierge notes from the booking form (booking_access). Best effort: the booking is already
 * confirmed and the notes are also in the Outlook event and the studio email.
 */
export async function saveAccessNotes(bookingId: string, notes: string | undefined, reference: string): Promise<void> {
  if (!notes?.trim()) return;
  await getDb()
    .insert(bookingAccess)
    .values({ bookingId, notes: notes.trim() })
    .onConflictDoNothing()
    .catch((err) => log.error("booking.db", "Gate/parking notes not saved", { reference, error: reason(err) }));
}

/** Notes of these bookings (empty if the table isn't there yet). */
export async function accessFor(bookingIds: string[]): Promise<BookingAccess[]> {
  if (!bookingIds.length) return [];
  return getDb()
    .select()
    .from(bookingAccess)
    .where(inArray(bookingAccess.bookingId, bookingIds))
    .catch((err) => {
      log.error("booking.db", "Could not load gate/parking notes", { error: reason(err) });
      return [];
    });
}
