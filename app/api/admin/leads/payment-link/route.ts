import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { sendPaymentLinkEmail } from "@/lib/booking/after-session";

export const dynamic = "force-dynamic";

/** Owner only: email the family their payment link (any time, before or after the session). */
export function POST(req: Request) {
  return leadAction(req, z.object({ reference: z.string().trim().min(3).max(40) }), "admin.payment-link", (row) => sendPaymentLinkEmail(row));
}
