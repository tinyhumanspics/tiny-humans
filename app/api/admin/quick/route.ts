import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";
import { listQuickRequests, QuickNotReadyError } from "@/lib/quick/server";

export const dynamic = "force-dynamic";

/** Owner only: the quick form's requests, newest first (/admin → Quotes / Booking). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ requests: [], notReady: "The database isn't connected yet." });
  try {
    return NextResponse.json({ requests: await listQuickRequests() }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof QuickNotReadyError) return NextResponse.json({ requests: [], notReady: err.message });
    log.error("admin.quick", "Quick requests not loaded", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the quick form's requests. Please try again." }, { status: 500 });
  }
}
