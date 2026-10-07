import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { sendAfterSessionEmail } from "@/lib/booking/after-session";

export const dynamic = "force-dynamic";

/** Owner only: "Session done" → thank-you + payment link email. */
export function POST(req: Request) {
  return leadAction(req, z.object({ reference: z.string().trim().min(3).max(40) }), "admin.after-session", (row) => sendAfterSessionEmail(row));
}
