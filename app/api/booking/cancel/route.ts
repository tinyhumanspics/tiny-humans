import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError } from "@/lib/booking/errors";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
const invalid = () => NextResponse.json({ error: "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.", code: "not_found" }, { status: 404, headers: NO_STORE });
const tooMany = () => NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again.", code: "rate_limited" }, { status: 429, headers: NO_STORE });
const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);

function fail(err: unknown) {
  if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
  log.error("api.cancel", "Unexpected error", { error: err as Error });
  return NextResponse.json({ error: "We couldn't load your booking just now. Please try again.", code: "server_error" }, { status: 500, headers: NO_STORE });
}

/** GET /api/booking/cancel?token=… : what the cancel page shows (no contact details). */
export async function GET(req: Request) {
  if (!(await allow("cancelGet", clientIp(req)))) return tooMany();
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenOk(token)) return invalid();
  try {
    return NextResponse.json({ booking: await getBookingProvider().getCancellation(token) }, { headers: NO_STORE });
  } catch (err) {
    return fail(err);
  }
}

const bodySchema = z.object({
  token: z.string(),
  reason: z.string().trim().min(3, "Please tell us why you need to cancel.").max(1000, "Please keep the reason under 1000 characters."),
});

/** POST /api/booking/cancel {token, reason}: cancels after the customer confirms on the page. */
export async function POST(req: Request) {
  if (!(await allow("cancelPost", clientIp(req)))) return tooMany();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please tell us why you need to cancel.", code: "invalid_request" }, { status: 400, headers: NO_STORE });
  if (!tokenOk(parsed.data.token)) return invalid();
  try {
    return NextResponse.json({ booking: await getBookingProvider().cancelWithToken(parsed.data.token, parsed.data.reason) }, { headers: NO_STORE });
  } catch (err) {
    return fail(err);
  }
}
