import { NextResponse } from "next/server";
import { dueByToken, dueSummaryOf } from "@/lib/due-date/server";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/booking/due?token=…: the due-date reservation behind a schedule link (the booking form fills itself in
 * and asks for no new deposit). 404 when the link is unknown, already used or cancelled.
 */
export async function GET(req: Request) {
  if (!(await allow("dueGet", clientIp(req)))) return NextResponse.json({ error: "Too many tries.", code: "rate_limited" }, { status: 429 });
  const row = await dueByToken(new URL(req.url).searchParams.get("token") ?? "");
  if (!row || (row.status !== "reserved" && row.status !== "scheduling")) return NextResponse.json({ error: "not_found", code: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ due: dueSummaryOf(row) }, { headers: { "cache-control": "no-store" } });
}
