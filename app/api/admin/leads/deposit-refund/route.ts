import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { BookingError } from "@/lib/booking/errors";
import { refundDeposit } from "@/lib/deposit/refund";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(3).max(40) });

/** Owner only: refund a paid deposit now (Stripe Refunds API), e.g. after an automatic refund failed. */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.deposit-refund", async (row) => {
    if (row.status === "pending") throw new BookingError("invalid_request", "This booking is still waiting for its deposit.");
    const r = await refundDeposit(row);
    if (!r) throw new BookingError("invalid_request", "There's no paid deposit to refund.");
    if (r.result === "refund_failed") throw new BookingError("server_error", `Stripe didn't refund it (${r.error ?? "error"}). Check that the Stripe key has "Refunds: Write", or refund it in Stripe.`);
  });
}
