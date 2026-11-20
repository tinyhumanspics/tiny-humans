import { NextResponse } from "next/server";
import { linkSummaryOf, openLinkByToken } from "@/lib/booking-links/server";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/booking/link?token=…: the session behind a family's booking link (owner, Nov 19), so /book fills itself in.
 * 404 when the link is unknown, already used or its day has passed.
 */
export async function GET(req: Request) {
  if (!(await allow("linkGet", clientIp(req)))) return NextResponse.json({ error: "Too many tries.", code: "rate_limited" }, { status: 429 });
  const row = await openLinkByToken(new URL(req.url).searchParams.get("token") ?? "");
  if (!row) return NextResponse.json({ error: "not_found", code: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ link: linkSummaryOf(row) }, { headers: { "cache-control": "no-store" } });
}
