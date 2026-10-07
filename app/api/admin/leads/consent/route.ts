import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { bookingConsents } from "@/lib/db/schema";
import { leadAction } from "@/lib/admin/lead-action";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(3).max(40), sms: z.boolean().optional(), photos: z.boolean().optional() });

/** Owner only: record a change of mind (e.g. the family replied STOP to texts). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.consent", async (row, input) => {
    const now = new Date();
    const set = {
      ...(input.sms !== undefined ? { sms: input.sms, smsAt: now } : {}),
      ...(input.photos !== undefined ? { photos: input.photos, photosAt: now } : {}),
      updatedAt: now,
    };
    await getDb()
      .insert(bookingConsents)
      .values({ bookingId: row.id, sms: input.sms ?? false, smsAt: input.sms !== undefined ? now : null, photos: input.photos ?? false, photosAt: input.photos !== undefined ? now : null })
      .onConflictDoUpdate({ target: bookingConsents.bookingId, set });
  });
}
