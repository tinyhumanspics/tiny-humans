import { z } from "zod";
import { leadAction } from "@/lib/admin/lead-action";
import { sendGalleryEmail } from "@/lib/booking/after-session";

export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().trim().min(3).max(40),
  galleryUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\/\S+$/.test(v), "The gallery link should start with https://")
    .optional(),
});

/** Owner only: "Gallery delivered" → review request + referral email (with the gallery link if given). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.gallery", (row, input) => sendGalleryEmail(row, input.galleryUrl || undefined));
}
