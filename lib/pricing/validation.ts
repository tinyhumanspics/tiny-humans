import { z } from "zod";

const money = z.number().finite().min(0).max(100000);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const bundleInputSchema = z
  .object({
    id: z.string().trim().max(64).optional(),
    name: z.string().trim().min(2, "Add a bundle name.").max(60),
    price: money,
    description: z.string().trim().max(200).optional().nullable(),
    durationMinutes: z.number().int().min(15, "Sessions must be at least 15 minutes.").max(480),
    photos: z.string().trim().max(20).optional().nullable(),
    badge: z.string().trim().max(24).optional().nullable(),
    features: z.array(z.string().trim().min(1).max(80)).max(12),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    offer: z
      .object({ enabled: z.boolean(), price: money, label: z.string().trim().max(30).optional().nullable(), endsOn: dateKey.optional().nullable() })
      .nullable()
      .optional(),
    extraBaby: z.object({
      active: z.boolean(),
      price: money,
      extraMinutes: z.number().int().min(0).max(240),
      extraPhotos: z.number().int().min(0).max(100),
      maxBabies: z.number().int().min(2).max(3),
    }),
  })
  .refine((b) => !b.offer?.enabled || (b.offer.price > 0 && b.offer.price < b.price), "The offer price must be lower than the regular price.")
  .refine((b) => !b.offer?.enabled || Boolean(b.offer.endsOn), "Add the date the offer ends.");

export const codeInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(3, "Codes need at least 3 characters.")
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only.")
      .transform((v) => v.toUpperCase()),
    type: z.enum(["percent", "fixed"]),
    value: z.number().finite().positive("Add the discount amount."),
    bundleIds: z.array(z.string().min(1)).min(1, "Choose at least one bundle."),
    active: z.boolean(),
    expiresOn: dateKey.nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    onePerEmail: z.boolean(),
    internalNote: z.string().trim().max(200).nullable().optional(),
  })
  .refine((c) => c.type !== "percent" || c.value <= 100, "A percentage can't be more than 100.");

export type BundleInput = z.infer<typeof bundleInputSchema>;
export type CodeInput = z.infer<typeof codeInputSchema>;
