import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { bookingCompletions } from "@/lib/db/schema";
import { leadAction } from "@/lib/admin/lead-action";
import { BookingError } from "@/lib/booking/errors";
import { isMissingTable } from "@/lib/deposit/server";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(3).max(40), completed: z.boolean() });

/**
 * Owner only: mark a lead "Completed" (or take it back), owner Nov 11: it moves to Leads → Completed (past clients, for
 * email marketing). Only confirmed or rescheduled sessions; the booking itself doesn't change.
 */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.complete", async (row, input) => {
    if (input.completed && row.status !== "confirmed" && row.status !== "rescheduled") {
      throw new BookingError("invalid_request", "Only confirmed or rescheduled sessions can be marked completed.");
    }
    try {
      const db = getDb();
      if (input.completed) await db.insert(bookingCompletions).values({ bookingId: row.id }).onConflictDoNothing();
      else await db.delete(bookingCompletions).where(eq(bookingCompletions.bookingId, row.id));
    } catch (err) {
      if (isMissingTable(err)) throw new BookingError("invalid_request", "Run the Completed SQL (drizzle/0030_booking_completions.sql) in Neon first.");
      throw err;
    }
  });
}
