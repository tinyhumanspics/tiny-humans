import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { BookingError } from "@/lib/booking/errors";
import { setReviewApproved } from "@/lib/reviews/server";

export const dynamic = "force-dynamic";

/** Owner only: pick (or unpick) a review for the website. Needs the family's OK. */
export function POST(req: Request) {
  return leadAction(req, z.object({ reference: z.string().trim().min(3).max(40), approved: z.boolean() }), "admin.review", async (row, input) => {
    if (!(await setReviewApproved(row.id, input.approved))) throw new BookingError("invalid_request", "This review can't be used on the website (no review, or the family didn't say OK).");
  });
}
