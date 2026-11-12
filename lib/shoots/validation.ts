import { z } from "@/lib/validation/zod";
import { BOOKING_KEY } from "./from-bookings";
import { LIST_LIMITS, linesOf } from "./lists";
import { MAX_LINK_LENGTH, normalizeLink } from "./links";
import { TICK_KEY } from "./ticks";

/** What the Shoots API accepts (spec §6). Every owner route parses its input with these before touching the database. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A real calendar day, "YYYY-MM-DD". */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day.").refine((d) => {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  return y >= 2020 && y <= 2100 && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
}, "Pick a day.");

/** "HH:MM", 24 h. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a start time.");

/** A folder address: the shoot's row id, or "b-<booking reference>" for a booking. */
export const shootKeySchema = z.string().refine((k) => UUID.test(k) || BOOKING_KEY.test(k), "That shoot doesn't exist.");
export const uuidSchema = z.string().regex(UUID, "Not found.");

const line = (max: number) => z.string().trim().max(max, `Keep each line under ${max} characters.`);

/** One per line (or an array from the API): trimmed, blank lines dropped, each line once. */
const lines = (maxLines: number, maxLength: number) =>
  z
    .union([z.string().max(maxLines * (maxLength + 2)), z.array(z.string().max(maxLength * 2)).max(maxLines * 2)])
    .transform((v) => linesOf(Array.isArray(v) ? v.join("\n") : v))
    .pipe(z.array(line(maxLength)).max(maxLines, `Keep it under ${maxLines} lines.`));

/** Edits to a shoot's folder (PATCH /api/admin/shoots/[id]). Day/start/place only apply to shoots without a booking. */
export const shootPatchSchema = z
  .object({
    title: line(120).nullable().optional(),
    tabLabel: line(40).nullable().optional(),
    said: z.string().max(4000, "Keep it under 4,000 characters.").optional(),
    confirm: lines(40, 300).optional(),
    bringExtra: lines(40, 200).optional(),
    date: dateSchema.optional(),
    startTime: timeSchema.nullable().optional(),
    place: line(200).nullable().optional(),
  })
  .strict();
export type ShootPatch = z.infer<typeof shootPatchSchema>;

/** "+ Shoot without a booking": title, day, start, place. */
export const newStyledShootSchema = z
  .object({
    title: line(120).min(1, "Give it a title."),
    date: dateSchema,
    startTime: timeSchema.nullable().optional(),
    place: line(200).nullable().optional(),
  })
  .strict();
export type NewStyledShoot = z.infer<typeof newStyledShootSchema>;

const group = z.enum(["inspo", "bts"]);
const caption = z.string().trim().max(500, "Keep it under 500 characters.");

/** ?link= of the video player / cover routes: one pasted link, as saved. */
export const videoLinkSchema = z.string().trim().min(1, "Which link?").max(MAX_LINK_LENGTH, "That link is too long.");

/** A pasted link or a text-only item (photos and videos come through the upload routes). */
export const newInspoSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("link"),
      group,
      url: z
        .string()
        .max(MAX_LINK_LENGTH, "That link is too long.")
        .transform((v, ctx) => {
          const url = normalizeLink(v);
          if (!url) ctx.addIssue({ code: "custom", message: "That doesn't look like a link. Paste the whole address." });
          return url ?? "";
        }),
      caption: caption.optional().default(""),
    })
    .strict(),
  z.object({ type: z.literal("note"), group, caption }).strict(),
]);
export type NewInspo = z.infer<typeof newInspoSchema>;

/** A caption, who's in the shot ("all", "baby:0"… "fam:4"), or both. */
export const inspoPatchSchema = z
  .object({
    caption: caption.optional(),
    who: z.array(z.string().regex(/^(all|baby:[0-2]|fam:[0-4])$/, "Pick people from this booking.")).max(9).optional(),
  })
  .strict()
  .refine((p) => p.caption !== undefined || p.who !== undefined, "Nothing to save.");

/** What we always bring: a new section, or a section's name/items/order. */
export const newBringSectionSchema = z.object({ name: line(LIST_LIMITS.nameLength).optional().default("") }).strict();
export const bringSectionPatchSchema = z
  .object({
    name: line(LIST_LIMITS.nameLength).optional(),
    items: lines(LIST_LIMITS.items, LIST_LIMITS.itemLength).optional(),
    sort: z.number().int().min(0).max(1000).optional(),
  })
  .strict();
export type BringSectionPatch = z.infer<typeof bringSectionPatchSchema>;

/** A tick on a day sheet ({ date, key, on }). */
export const tickSchema = z
  .object({
    date: dateSchema,
    key: z.string().max(200).regex(TICK_KEY, "Unknown item."),
    on: z.boolean(),
  })
  .strict();

/** GET /api/admin/shoots?from=&to= (at most a year at a time). */
export const rangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((r) => r.from <= r.to, "The range ends before it starts.")
  .refine((r) => Date.parse(r.to) - Date.parse(r.from) <= 400 * 86_400_000, "Pick a shorter range.");
