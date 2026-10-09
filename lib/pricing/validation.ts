import { z } from "zod";

const money = z.number().finite().min(0).max(100000);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const translatedBundleSchema = z.object({
  name: z.string().trim().max(60),
  description: z.string().trim().max(200).optional().nullable(),
  badge: z.string().trim().max(24).optional().nullable(),
  offerLabel: z.string().trim().max(30).optional().nullable(),
  features: z.array(z.string().trim().max(80)).max(12),
});

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
    /** null = no Spanish draft yet; once started, every live English text field needs its Spanish pair. */
    spanish: translatedBundleSchema.nullable().optional(),
    extraBaby: z.object({
      active: z.boolean(),
      price: money,
      extraMinutes: z.number().int().min(0).max(240),
      extraPhotos: z.number().int().min(0).max(100),
      maxBabies: z.number().int().min(2).max(3),
    }),
  })
  .refine((b) => !b.offer?.enabled || (b.offer.price > 0 && b.offer.price < b.price), "The offer price must be lower than the regular price.")
  .refine((b) => !b.offer?.enabled || Boolean(b.offer.endsOn), "Add the date the offer ends.")
  .superRefine((b, ctx) => {
    const s = b.spanish;
    if (!s) return;
    if (s.name.length < 2) ctx.addIssue({ code: "custom", path: ["spanish", "name"], message: "Add the Spanish bundle name, or clear the Spanish section." });
    if (s.features.length !== b.features.length || s.features.some((item) => !item)) {
      ctx.addIssue({ code: "custom", path: ["spanish", "features"], message: "Translate every included item into Spanish." });
    }
    if (b.description && !s.description) ctx.addIssue({ code: "custom", path: ["spanish", "description"], message: "Translate the bundle description into Spanish." });
    if (!b.description && s.description) ctx.addIssue({ code: "custom", path: ["spanish", "description"], message: "Clear the Spanish description, or add the English description too." });
    if (b.badge && !s.badge) ctx.addIssue({ code: "custom", path: ["spanish", "badge"], message: "Translate the small label into Spanish." });
    if (!b.badge && s.badge) ctx.addIssue({ code: "custom", path: ["spanish", "badge"], message: "Clear the Spanish small label, or add the English label too." });
    if (b.offer?.label && !s.offerLabel) ctx.addIssue({ code: "custom", path: ["spanish", "offerLabel"], message: "Translate the offer label into Spanish." });
    if (!b.offer?.label && s.offerLabel) ctx.addIssue({ code: "custom", path: ["spanish", "offerLabel"], message: "Clear the Spanish offer label, or add the English label too." });
  });

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
