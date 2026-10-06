import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getCatalog, listCodes } from "@/lib/pricing/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Owner only: every bundle (incl. inactive) and every discount code (incl. internal notes). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ bundles: await getCatalog(), codes: await listCodes().catch(() => []), databaseConfigured: isDatabaseConfigured() }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("admin.pricing", "Load failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load pricing." }, { status: 500 });
  }
}
