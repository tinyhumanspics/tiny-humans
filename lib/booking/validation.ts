import { z } from "zod";
import { babyAgeOptions } from "@/config/booking";

/** Server-side validation of booking requests. Never trust the browser form alone. */
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");
const text = (max: number) => z.string().trim().max(max);

export const availabilityQuerySchema = z
  .object({ bundleId: z.string({ message: "Choose a bundle first." }).trim().min(1, "Choose a bundle first.").max(64), from: dateKey, to: dateKey })
  .refine((q) => q.from <= q.to, "from must be before to")
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 62, "Range too long");

export const bookingRequestSchema = z.object({
  bundleId: z.string({ message: "Choose a bundle first." }).trim().min(1, "Choose a bundle first.").max(64),
  slot: z.object({ date: dateKey, start: hhmm }, { message: "Pick a day and time." }).passthrough(),
  contact: z.object({
    parentName: text(120).min(2, "Add the parent or guardian's name."),
    email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
    phone: text(40).refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a phone number with at least 10 digits."),
    babyName: text(80).optional().transform((v) => v || undefined),
    babyAge: z.enum(babyAgeOptions as unknown as [string, ...string[]], { message: "Choose your baby's age." }),
    notes: text(1500).optional().transform((v) => v || undefined),
  }),
  address: z.object({
    street: text(200).min(4, "Add the street address."),
    city: text(100).min(2, "Add the city."),
    zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  }),
  inspirationPhotoId: text(64).optional(),
  requestId: z.string().trim().min(8).max(100).optional(),
  // Only the code text is accepted; prices and discounts are always calculated on the server.
  discountCode: z.string().trim().max(40).optional().transform((v) => v || undefined),
  // Spam signals (never stored): a hidden field people never see, and how long the form was open.
  hp: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type ValidBookingRequest = z.infer<typeof bookingRequestSchema>;

export const rescheduleSchema = z.object({ date: dateKey, start: hhmm });
