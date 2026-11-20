import { NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/db/client";
import { NO_STORE, tooMany } from "@/lib/booking/manage-api";
import { extrasView, startExtrasCheckout } from "@/lib/photo-extras/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const body = z.object({
  b: z.string().max(40),
  s: z.string().max(40),
  extras: z.number().int().min(0).max(100),
  full: z.boolean(),
  raw: z.boolean(),
  note: z.string().max(500).default(""),
});

/** GET /api/extras?b=<reference>&s=<signature>[&paid=1]: the photo extras page (owner, Nov 20). */
export async function GET(req: Request) {
  if (!(await allow("extrasGet", clientIp(req)))) return tooMany();
  if (!isDatabaseConfigured()) return NextResponse.json({ state: "closed" }, { headers: NO_STORE });
  const q = new URL(req.url).searchParams;
  try {
    return NextResponse.json(await extrasView(q.get("b"), q.get("s"), q.get("paid") === "1"), { headers: NO_STORE });
  } catch (err) {
    log.error("api.extras", "Could not load the extras page", { error: err as Error });
    return NextResponse.json({ error: "failed" }, { status: 500, headers: NO_STORE });
  }
}

/** POST {b, s, extras, full, raw, note}: prices the choice on the server and returns the Stripe page to pay it. */
export async function POST(req: Request) {
  if (!(await allow("extrasPost", clientIp(req)))) return tooMany();
  const raw = await readJson(req, BODY_LIMITS.small);
  if (raw === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const parsed = body.safeParse(raw);
  if (!parsed.success || !isDatabaseConfigured()) return NextResponse.json({ error: "changed" }, { status: 400, headers: NO_STORE });
  const { b, s, note, ...choice } = parsed.data;
  try {
    const out = await startExtrasCheckout(b, s, choice, note);
    if ("url" in out) return NextResponse.json(out, { headers: NO_STORE });
    const status = out.error === "invalid" ? 404 : out.error === "closed" ? 410 : out.error === "stripe" ? 502 : 409;
    return NextResponse.json(out, { status, headers: NO_STORE });
  } catch (err) {
    log.error("api.extras", "Could not open the extras payment page", { error: err as Error });
    return NextResponse.json({ error: "stripe" }, { status: 500, headers: NO_STORE });
  }
}
