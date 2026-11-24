import { z } from "@/lib/validation/zod";
import { isDateKey } from "@/lib/validation/date-key";
import { usMobile } from "./types";

/** "Send request" (brief 02): 4 typed fields + what was picked on screen 1. Re-checked on the server. */
export const requestSchema = z
  .object({
    clientId: z.string().trim().min(8).max(100),
    locale: z.enum(["en", "es"]),
    type: z.enum(["date", "due_date"]),
    bundleId: z.string().trim().min(1).max(64),
    babyCount: z.number().int().min(1).max(3),
    slot: z.object({ date: z.string().refine(isDateKey), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).optional(),
    dueDate: z.string().refine(isDateKey).optional(),
    firstName: z.string().trim().min(1).max(60),
    mobile: z.string().trim().max(30).refine((v) => usMobile(v) !== null),
    email: z.string().trim().toLowerCase().max(254).email(),
    zip: z.string().trim().regex(/^\d{5}$/),
    textConsent: z.boolean(),
    /** Sent from a due-date reservation's schedule link: books that reservation (its bundle, kept price, paid deposit). */
    dueToken: z.string().trim().max(200).optional(),
    /** Sent from the owner's booking link (owner, Nov 19): its babies and source go with the request. */
    linkToken: z.string().trim().max(200).optional(),
    inspiration: z.string().trim().max(80).optional(),
    /** Bundles with 2+ setups (owner, Nov 24): prop ideas, optional. */
    propIdeas: z.string().trim().max(500).optional(),
    hp: z.string().max(200).optional(),
    elapsedMs: z.number().int().nonnegative().optional(),
  })
  .refine((r) => (r.type === "date" ? Boolean(r.slot) : Boolean(r.dueDate)), { message: "Pick a day and time, or your due date." });

export type ValidRequest = z.infer<typeof requestSchema>;
