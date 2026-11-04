import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { BookingError } from "@/lib/booking/errors";
import { isDatabaseConfigured } from "@/lib/db/client";
import { isMissingTable } from "@/lib/deposit/server";
import { log } from "@/lib/log";
import { followUpAndReload } from "@/lib/unfinished/server";
import { periodOf } from "@/lib/unfinished/period";

export const dynamic = "force-dynamic";
// "Send to everyone": up to 40 emails, about 2 a second
export const maxDuration = 60;

const schema = z.union([z.object({ id: z.uuid() }), z.object({ all: z.literal(true) })]);

/** Owner only: send the "What stopped you?" email to one family ({id}) or to everyone not contacted yet ({all: true}). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose who to email." }, { status: 400 });
  const { days, source } = periodOf(new URL(req.url));
  try {
    return NextResponse.json(await followUpAndReload(parsed.data, days, source));
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (isMissingTable(err)) return NextResponse.json({ error: "The tables for unfinished bookings don't exist yet. Run drizzle/0022_unfinished_bookings.sql in Neon." }, { status: 503 });
    log.error("admin.unfinished", "Follow-up failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
