import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { BookingError } from "@/lib/booking/errors";
import { payWithLink } from "@/lib/deposit/flow";
import { depositLinkReference } from "@/lib/deposit/request";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

/**
 * POST /api/booking/deposit/pay { b, k }: "Pay the deposit" on a family's link (a booking the owner made for them, or a
 * held booking whose page closed): the open Stripe page, or a new one that closes when the hold ends.
 */
export async function POST(req: Request) {
  if (!(await allow("depositPost", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse();
  const body = input as { b?: unknown; k?: unknown } | null;
  const reference = depositLinkReference(body?.b, body?.k);
  if (!reference || !isDatabaseConfigured()) return NextResponse.json({ error: en.bookingFlow.depositReturn.invalidTitle, code: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ url: await payWithLink(reference) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.deposit", "Pay from link failed", { reference, error: err as Error });
    return NextResponse.json({ error: en.bookingFlow.depositReturn.error, code: "server_error" }, { status: 500 });
  }
}
