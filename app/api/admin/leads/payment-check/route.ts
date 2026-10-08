import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { checkPaymentWithStripe } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(3).max(40) });

/** Owner only: "Check with Stripe" — asks Stripe whether this booking was paid and records it (backup for a missed webhook). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.payment-check", (row) => checkPaymentWithStripe(row));
}
