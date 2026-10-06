import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError } from "@/lib/booking/errors";
import { log } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// The browser sends only a bundle id, an optional code and the email. The price is calculated here.
const body = z.object({ bundleId: z.string().trim().min(1).max(64), code: z.string().trim().max(40).optional(), email: z.string().trim().max(254).optional() });

/** POST /api/booking/quote: server-calculated price (regular, special offer, or one discount code). */
export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 30, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please check the code and try again.", code: "invalid_request" }, { status: 400 });
  try {
    return NextResponse.json({ quote: await getBookingProvider().quote(p.data.bundleId, p.data.code, p.data.email) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.quote", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: "We couldn't check that just now. Please try again.", code: "server_error" }, { status: 500 });
  }
}
