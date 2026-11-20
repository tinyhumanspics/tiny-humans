import { babyAgeOptions, babyGenders, isOwnerSource, type BabyGender } from "@/config/booking";
import { isDateKey } from "@/lib/validation/date-key";
import { z } from "@/lib/validation/zod";

/**
 * /admin → Quotes / Booking → "Send a booking link" (owner, Nov 19): the session a family agreed with the owner by
 * Instagram, text…; their link opens /book with it filled in, and they add their own details.
 */
export interface LinkBaby {
  /** One of config/booking.ts babyAgeOptions. */
  age: string;
  name?: string;
  /** Boy or girl (owner, Nov 19); left out = not sure yet. */
  gender?: BabyGender;
}

/** What a family's link fills in on /book (GET /api/booking/link). */
export interface BookingLinkSummary {
  bundleId: string;
  babies: LinkBaby[];
  zip: string;
  date: string;
  /** "HH:MM"; null = they pick the time that day. */
  start: string | null;
  locale: "en" | "es";
}

/** The owner's form (POST /api/admin/booking-links). */
export const bookingLinkInput = z.object({
  bundleId: z.string().trim().min(1).max(64),
  babies: z
    .array(z.object({ age: z.enum(babyAgeOptions, "Pick the baby's age."), name: z.string().trim().max(80).optional(), gender: z.enum(babyGenders).optional() }))
    .min(1)
    .max(3),
  zip: z.string().trim().regex(/^\d{5}$/, "Add their 5-digit ZIP code."),
  date: z.string().refine(isDateKey, "Pick the day."),
  start: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  locale: z.enum(["en", "es"]),
  source: z.string().refine(isOwnerSource, "Pick how they reached you."),
});
export type BookingLinkInput = z.infer<typeof bookingLinkInput>;

/** The link to send and a text message with it, in their language. */
export interface BookingLinkMade {
  url: string;
  text: string;
}
