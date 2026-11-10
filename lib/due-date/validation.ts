import { z } from "@/lib/validation/zod";
import { isDateKey } from "@/lib/validation/date-key";

const text = (max: number) => z.string().trim().max(max);

/** POST /api/due-date: a "Not born yet" reservation (prices, travel and the deposit are worked out on the server). */
export const dueRequestSchema = z.object({
  bundleId: z.string({ message: "Choose a bundle first." }).trim().min(1, "Choose a bundle first.").max(64),
  locale: z.enum(["en", "es"]).optional(),
  babyCount: z.number().int().min(1).max(3).default(1),
  dueDate: z.string().refine(isDateKey, "Pick your due date."),
  contact: z.object({
    parentName: text(120).min(2, "Add your name."),
    email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
    phone: text(40).refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a phone number with at least 10 digits."),
    notes: text(1500).optional().transform((v) => v || undefined),
  }),
  address: z.object({
    street: text(200).min(4, "Add the street address."),
    unit: text(40).optional().transform((v) => v || undefined),
    city: text(100).min(2, "Add the city."),
    zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  }),
  requestId: z.string().trim().min(8).max(100).optional(),
  // spam signals (never stored)
  hp: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type DueRequest = z.infer<typeof dueRequestSchema>;
