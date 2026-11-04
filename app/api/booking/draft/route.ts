import { cookies } from "next/headers";
import { z } from "zod";
import { DRAFT_STEPS, unfinishedRules } from "@/config/unfinished";
import { locales } from "@/i18n/config";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson } from "@/lib/security/body";
import { SOURCE_COOKIE } from "@/lib/tracking/attribution";
import { saveDraft } from "@/lib/unfinished/server";

export const dynamic = "force-dynamic";

const optional = (max: number) => z.string().trim().max(max).optional();
const schema = z.object({
  email: z.string().trim().max(254).email(),
  parentName: optional(unfinishedRules.maxNameLength),
  phone: optional(40),
  bundleId: z.string().trim().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  zip: z.string().trim().regex(/^\d{5}$/).optional(),
  step: z.enum(DRAFT_STEPS),
  locale: z.enum(locales),
  replaces: z.string().trim().max(254).email().optional(),
});

/**
 * POST: what a family has typed on the booking form so far (parent contact, bundle, date/time, ZIP; never baby
 * details), for /admin → Unfinished bookings. Always 204: a missing table or a bad save never bothers the family.
 */
export async function POST(req: Request) {
  if (!(await allow("draft", clientIp(req)))) return new Response(null, { status: 204 });
  const body = await readJson(req, BODY_LIMITS.small);
  if (body === TOO_LARGE) return new Response(null, { status: 204 });
  const parsed = schema.safeParse(body);
  if (parsed.success) await saveDraft(parsed.data, (await cookies()).get(SOURCE_COOKIE)?.value);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
