import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { sendSneakPeekEmail } from "@/lib/booking/after-session";

export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().trim().min(3).max(40),
  galleryUrl: z.string().trim().max(500).regex(/^https:\/\/\S+$/, "Paste the Pixieset gallery link (it starts with https://)."),
  favorites: z.string().trim().min(1, "How many favorites can they choose?").max(12),
});

/** Owner only: "Send sneak peek" → thank-you + Pixieset gallery + "choose your N favorites" (+ pay button if unpaid). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.sneak-peek", (row, input) => sendSneakPeekEmail(row, input.galleryUrl, input.favorites));
}
