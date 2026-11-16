import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { runReminders } from "@/lib/booking/reminders";
import { sweepDeposits } from "@/lib/deposit/flow";
import { sweepDueDeposits } from "@/lib/due-date/server";
import { log } from "@/lib/log";
import { isCronRequest } from "@/lib/security/cron";
import { errorCode, reportFailure } from "@/lib/monitoring/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET: daily session reminders (Vercel Cron, see vercel.json; Vercel sends `Authorization: Bearer $CRON_SECRET`), after
 * settling any deposit a missed Stripe webhook left waiting.
 * `?dryRun=1` lists which bookings are due without sending. The response holds booking references only.
 */
export async function GET(req: Request) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!isDatabaseConfigured()) return NextResponse.json({ skipped: "no database" }, { headers: NO_STORE });
  const secret = process.env.CRON_SECRET ?? "";
  const url = new URL(req.url);
  // Testing outside production only: run as if it were another moment (ISO date-time).
  const at = process.env.VERCEL_ENV !== "production" ? url.searchParams.get("now") : null;
  try {
    const dryRun = url.searchParams.get("dryRun") === "1";
    // backstop for missed Stripe webhooks: deposit pages that ran out, paid bookings not confirmed yet
    const deposits = dryRun ? undefined : await sweepDeposits(new Date(), 50);
    // "Not born yet" payment pages that closed unpaid (the automatic email), if a webhook was missed
    const dueDeposits = dryRun ? undefined : await sweepDueDeposits(new Date(), 50);
    const result = await runReminders({ secret, dryRun, now: at ? new Date(at) : undefined });
    return NextResponse.json({ ...result, deposits, dueDeposits }, { headers: NO_STORE });
  } catch (err) {
    log.error("reminders", "Reminder run failed", { error: err as Error });
    await reportFailure("cron", `Daily reminders and deposit checks failed (${errorCode(err)})`);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500, headers: NO_STORE });
  }
}
