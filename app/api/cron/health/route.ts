import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";
import { errorCode, reportFailure } from "@/lib/monitoring/report";
import { runHealthCheck } from "@/lib/monitoring/server";
import { isCronRequest } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET: the daily health check (Vercel Cron, vercel.json). Emails the owner (ALERT_EMAIL) the failures of the last 24
 * hours and anything that needs doing (Microsoft secret expiry), only when there is something, plus an "all good" line
 * every Monday. The response holds counts only. `?now=` (outside production) runs it as another moment.
 */
export async function GET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured()) return NextResponse.json({ skipped: "no database" }, { headers: NO_STORE });
  const at = process.env.VERCEL_ENV !== "production" ? new URL(req.url).searchParams.get("now") : null;
  try {
    return NextResponse.json(await runHealthCheck(at ? new Date(at) : new Date()), { headers: NO_STORE });
  } catch (err) {
    log.error("monitor", "Health check failed", { error: err as Error });
    await reportFailure("cron", `Daily health check failed (${errorCode(err)})`);
    return NextResponse.json({ error: "Health check failed" }, { status: 500, headers: NO_STORE });
  }
}
