import { NextResponse } from "next/server";
import { getBookingProvider } from "@/lib/booking/server";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/booking/manage?token=… : the token holder's booking (reschedule page). */
export async function GET(req: Request) {
  if (!rateLimit(`manage-get:${clientIp(req)}`, 40, 10 * 60_000)) return tooMany();
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenOk(token)) return invalidLink();
  try {
    return NextResponse.json({ booking: await getBookingProvider().getManagedBooking(token) }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.manage");
  }
}
