import { z } from "@/lib/validation/zod";
import { OFFERED_BACKDROP_IDS } from "@/config/backdrops";
import { daysBetweenDateKeys, isDateKey } from "@/lib/validation/date-key";

/** Server-side validation of booking inputs. Never trust the browser form alone. */
const dateKey = z.string().refine(isDateKey, "Invalid date");
const text = (max: number) => z.string().trim().max(max);

export const availabilityQuerySchema = z
  .object({ bundleId: z.string({ message: "Choose a bundle first." }).trim().min(1, "Choose a bundle first.").max(64), babyCount: z.coerce.number().int().min(1).max(3).default(1), from: dateKey, to: dateKey, zip: z.string().trim().regex(/^\d{5}$/).optional() })
  .refine((q) => q.from <= q.to, "from must be before to")
  .refine((q) => (daysBetweenDateKeys(q.from, q.to) ?? Infinity) <= 62, "Range too long");

/** Backdrop picks: backdrops offered now, no repeats, at most 3. */
export const backdropPicks = z
  .array(z.enum(OFFERED_BACKDROP_IDS))
  .max(3)
  .refine((a) => new Set(a).size === a.length, "Pick each backdrop only once.");

/** A family's home on their links (the Prepare page, the deposit link): street with apt or unit, city, gate notes. */
export const homeInput = z.object({ street: text(200).min(4, "Add your street address."), city: text(100).min(2, "Add your city."), accessNotes: text(300).optional() });
