import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingAccess, type BookingAccess } from "@/lib/db/schema";
import { log } from "@/lib/log";

/** A failed query's message repeats its values (the family's gate code), so only the database's own reason is logged. */
const reason = (err: unknown) => new Error((err as { cause?: Error }).cause?.message ?? "query failed");

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
