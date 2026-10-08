import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";

export const dynamic = "force-dynamic";

/** GET /api/booking/travel?zip=33401: distance + travel fee for the line under the ZIP box (the booking recalculates it). */
export async function GET(req: Request) {
  if (!(await allow("travel", clientIp(req)))) return NextResponse.json({ error: "Too many requests. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const zip = new URL(req.url).searchParams.get("zip")?.trim() ?? "";
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ error: "Enter a 5-digit ZIP code.", code: "invalid_request" }, { status: 400 });
  return NextResponse.json({ travel: travelQuote(zip, await getTravelSettings()) }, { headers: { "cache-control": "no-store" } });
}
