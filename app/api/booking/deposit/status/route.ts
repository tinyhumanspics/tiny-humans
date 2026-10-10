import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { depositReturnState } from "@/lib/deposit/flow";
import { clientContext, depositLinkReference } from "@/lib/deposit/request";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

/**
 * GET /api/booking/deposit/status?b=<reference>&k=<signature>: the booking page after the deposit's Stripe page.
 * Checks with Stripe while the deposit is still waiting, confirms the booking once it's paid.
 */
export async function GET(req: Request) {
  if (!(await allow("depositGet", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429, headers });
  const q = new URL(req.url).searchParams;
  const reference = depositLinkReference(q.get("b"), q.get("k"));
  if (!reference || !isDatabaseConfigured()) return NextResponse.json({ state: "invalid" }, { headers });
  try {
    return NextResponse.json(await depositReturnState(reference, await clientContext(req)), { headers });
  } catch (err) {
    log.error("api.deposit", "Status check failed", { reference, error: err as Error });
    return NextResponse.json({ error: en.bookingFlow.depositReturn.error, code: "server_error" }, { status: 500, headers });
  }
}
