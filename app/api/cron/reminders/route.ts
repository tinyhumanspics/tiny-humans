import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { runReminders } from "@/lib/booking/reminders";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * GET: daily session reminders (Vercel Cron, see vercel.json; Vercel sends `Authorization: Bearer $CRON_SECRET`).
 * `?dryRun=1` lists which bookings are due without sending. The response holds booking references only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16 || !sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!isDatabaseConfigured()) return NextResponse.json({ skipped: "no database" }, { headers: NO_STORE });
  const url = new URL(req.url);
  // Testing outside production only: run as if it were another moment (ISO date-time).
  const at = process.env.VERCEL_ENV !== "production" ? url.searchParams.get("now") : null;
  try {
    const result = await runReminders({ secret, dryRun: url.searchParams.get("dryRun") === "1", now: at ? new Date(at) : undefined });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    log.error("reminders", "Reminder run failed", { error: err as Error });
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500, headers: NO_STORE });
  }
}
