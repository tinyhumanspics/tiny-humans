import { cookies } from "next/headers";
import { z } from "zod";
import { FUNNEL_STEPS } from "@/config/unfinished";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson } from "@/lib/security/body";
import { SOURCE_COOKIE } from "@/lib/tracking/attribution";
import { countFunnelStep } from "@/lib/unfinished/server";

export const dynamic = "force-dynamic";

const schema = z.object({ step: z.enum(FUNNEL_STEPS), bundleId: z.string().trim().min(1).max(64) });

/** POST {step, bundleId}: +1 for that booking-form step today (no names, emails, IPs or ids). Always 204. */
export async function POST(req: Request) {
  if (!(await allow("funnel", clientIp(req)))) return new Response(null, { status: 204 });
  const body = await readJson(req, BODY_LIMITS.small);
  if (body === TOO_LARGE) return new Response(null, { status: 204 });
  const parsed = schema.safeParse(body);
  if (parsed.success) await countFunnelStep(parsed.data.step, parsed.data.bundleId, (await cookies()).get(SOURCE_COOKIE)?.value);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
