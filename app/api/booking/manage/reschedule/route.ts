import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingProvider } from "@/lib/booking/server";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// Only date + time can change. Anything else in the body (bundle, price, address...) is ignored.
const body = z.object({ token: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

/** POST {token, date, start}: reschedule after the customer confirms (rechecked server-side). */
export async function POST(req: Request) {
  if (!rateLimit(`manage-post:${clientIp(req)}`, 10, 10 * 60_000)) return tooMany();
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Pick a new day and time.", code: "invalid_request" }, { status: 400, headers: NO_STORE });
  if (!tokenOk(p.data.token)) return invalidLink();
  try {
    return NextResponse.json({ booking: await getBookingProvider().rescheduleWithToken(p.data.token, { date: p.data.date, start: p.data.start }) }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.manage.reschedule");
  }
}
