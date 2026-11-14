import { babyAgeOptions } from "@/config/booking";
import { z } from "@/lib/validation/zod";

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => v || undefined);

/** POST /api/quick: the quick form. Short on purpose: name, phone, email and ZIP are required, the rest is optional. */
export const quickRequestSchema = z.object({
  parentName: text(120).min(2, "name"),
  phone: text(40).refine((v) => v.replace(/\D/g, "").length >= 10, "phone"),
  email: z.string().trim().toLowerCase().max(254).email("email"),
  zip: z.string().trim().regex(/^\d{5}$/, "zip"),
  babyName: optional(80),
  babyAge: z.enum(babyAgeOptions as unknown as [string, ...string[]]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  bundleId: z.string().trim().regex(/^[a-z0-9-]{1,64}$/).optional().or(z.literal("").transform(() => undefined)),
  bestTime: optional(200),
  message: optional(1000),
  locale: z.enum(["en", "es"]).default("en"),
  // spam signals (never stored)
  hp: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
});
export type QuickRequestInput = z.infer<typeof quickRequestSchema>;
