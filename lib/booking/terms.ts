import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingTerms, type Booking, type BookingTerm } from "@/lib/db/schema";
import { log } from "@/lib/log";

/**
 * What each booking was promised when it was made (booking_terms): the online cancel/reschedule notice and the
 * bundle's photo count. Bookings without a row (the table missing, or a failed save) use today's setting.
 */
export async function saveBookingTerms(bookingId: string, noticeHours: number, photosLabel: string | null | undefined, reference: string): Promise<void> {
  await getDb()
    .insert(bookingTerms)
    .values({ bookingId, noticeHours, photosLabel: photosLabel?.trim() || null })
    .onConflictDoNothing()
    .catch((err) => log.error("booking.db", "Booking terms not saved (today's setting will apply)", { reference, error: err as Error }));
}

export async function termsFor(bookingIds: string[]): Promise<BookingTerm[]> {
  if (!bookingIds.length) return [];
  return getDb()
    .select()
    .from(bookingTerms)
    .where(inArray(bookingTerms.bookingId, bookingIds))
    .catch((err) => {
      log.error("booking.db", "Could not load booking terms", { error: err as Error });
      return [];
    });
}

/** The booking's own notice hours, else today's setting. */
export async function noticeHoursFor(row: Booking, currentSetting: number): Promise<number> {
  const [t] = await getDb()
    .select({ noticeHours: bookingTerms.noticeHours })
    .from(bookingTerms)
    .where(eq(bookingTerms.bookingId, row.id))
    .limit(1)
    .catch(() => []);
  return t?.noticeHours ?? currentSetting;
}

/** How many edited photos the booking's bundle included ("20"), from the booking's terms or its saved inclusions. */
export function photosLabelOf(row: Booking, terms?: BookingTerm): string | null {
  if (terms?.photosLabel) return terms.photosLabel;
  const line = (row.packageInclusions ?? []).find((l) => /edited/i.test(l));
  return line?.match(/\d+(?:\s*[–-]\s*\d+)?/)?.[0] ?? null;
}
