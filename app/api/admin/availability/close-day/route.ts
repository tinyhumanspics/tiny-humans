import { NextResponse } from "next/server";
import { bookingRules } from "@/config/booking";
import { closeDayAndNotify, closeDayWithoutEmail, getClosedDayImpact } from "@/lib/availability/close-day";
import { guardAvailability } from "@/lib/availability/api";
import { closeDaySchema } from "@/lib/availability/validation";
import { todayInZone } from "@/lib/booking/timezone";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= todayInZone(bookingRules.timeZone);
}

function failed(action: string, date: string): NextResponse {
  log.error("availability.close-day", `${action} failed`, { date });
  return NextResponse.json({ error: "Couldn't finish that day. The page is safe to refresh and try again." }, { status: 500 });
}

/** Owner-only preview of the future sessions already booked on one date. */
export async function GET(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!validDate(date)) return NextResponse.json({ error: "Pick today or a future date." }, { status: 400 });
  try {
    return NextResponse.json({ impact: await getClosedDayImpact(date) });
  } catch {
    return failed("review", date);
  }
}

/** Close the date first, then email each affected family a protected reschedule link. */
export async function POST(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = closeDaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the date and note." }, { status: 400 });
  if (!validDate(parsed.data.date)) return NextResponse.json({ error: "Pick today or a future date." }, { status: 400 });
  try {
    return NextResponse.json(parsed.data.notify ? await closeDayAndNotify(parsed.data.date, parsed.data.note) : await closeDayWithoutEmail(parsed.data.date));
  } catch {
    return failed("close and notify", parsed.data.date);
  }
}
