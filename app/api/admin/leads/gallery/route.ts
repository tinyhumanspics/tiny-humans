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
  /** Pixieset's download PIN (4 digits); only put into the email, never saved or logged. */
  downloadPin: z
    .string()
    .trim()
    .max(12, "The download PIN should be 4 to 12 letters or numbers.")
    .refine((v) => !v || /^[A-Za-z0-9]{4,12}$/.test(v), "The download PIN should be 4 to 12 letters or numbers.")
    .optional(),
});

/** Owner only: "Gallery delivered" → review request + referral email (with the gallery link and download PIN if given). */
export function POST(req: Request) {
  return leadAction(req, schema, "admin.gallery", (row, input) => sendGalleryEmail(row, input.galleryUrl || undefined, input.downloadPin || undefined));
}
