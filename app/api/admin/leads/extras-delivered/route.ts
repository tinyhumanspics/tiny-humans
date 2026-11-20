import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { BookingError } from "@/lib/booking/errors";
import { setExtrasDelivered } from "@/lib/photo-extras/server";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(3).max(40), orderId: z.string().uuid(), delivered: z.boolean() });

/** Owner only: the "Delivered" tick on a paid photo extras order (saves when; sends nothing). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.extras-delivered", async (row, input) => {
    if (!(await setExtrasDelivered(row.id, input.orderId, input.delivered))) throw new BookingError("invalid_request", "That order isn't paid yet, or it's gone.");
  });
}
