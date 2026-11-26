import { NextResponse } from "next/server";
import { bookingRules } from "@/config/booking";
import { isAdmin } from "@/lib/admin/auth";
import { getDashboard } from "@/lib/admin/dashboard";
import { parsePeriod } from "@/lib/admin/dashboard-period";
import { todayInZone } from "@/lib/booking/timezone";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Owner only: the dashboard numbers (sessions coming up; money, bookings, leads and changes of a period). `?from=&to=`
 * (YYYY-MM-DD, Miami dates, both included) picks the dates; without them, this month.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet, so there's nothing to show." }, { status: 503 });
  const q = new URL(req.url).searchParams;
  const picked = parsePeriod(q.get("from"), q.get("to"), todayInZone(bookingRules.timeZone));
  if ("error" in picked) return NextResponse.json({ error: picked.error }, { status: 400 });
  try {
    return NextResponse.json(await getDashboard(picked.period), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("admin.dashboard", "Could not load the dashboard", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the dashboard. Please try again." }, { status: 500 });
  }
}
