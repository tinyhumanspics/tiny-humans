import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { ownerDepositLink } from "@/lib/deposit/flow";

export const dynamic = "force-dynamic";

/**
 * Owner only: the family's deposit link, emailed ("email": true) or just prepared to copy. A released time is held
 * again for 30 minutes first (if it's still free). The fresh lead carries the link (deposit.link).
 */
export function POST(req: Request) {
  return leadAction(req, z.object({ reference: z.string().trim().min(3).max(40), email: z.boolean() }), "admin.deposit-link", async (row, input) => {
    await ownerDepositLink(row, { email: input.email });
  });
}
