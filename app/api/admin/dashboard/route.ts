import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { getDashboard } from "@/lib/admin/dashboard";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Owner only: the dashboard numbers (sessions coming up, bookings over time, sources, changes, emails). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet, so there's nothing to show." }, { status: 503 });
  try {
    return NextResponse.json(await getDashboard(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("admin.dashboard", "Could not load the dashboard", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the dashboard. Please try again." }, { status: 500 });
  }
}
