import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getLead, getLeadRow } from "@/lib/leads/server";
import { rescheduleBookingRow } from "@/lib/booking/reschedule";
import { manageFail } from "@/lib/booking/manage-api";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
const body = z.object({ reference: z.string().trim().min(3).max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

/** Owner only: move a booking to a new date/time (same availability engine, no customer cutoff). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Pick a new day and time." }, { status: 400 });
  try {
    const row = await getLeadRow(p.data.reference);
    if (!row) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    await rescheduleBookingRow(row, { date: p.data.date, start: p.data.start }, "admin");
    log.info("admin.leads", "Admin rescheduled booking", { reference: row.bookingReference });
    return NextResponse.json({ lead: await getLead(row.bookingReference) });
  } catch (err) {
    return manageFail(err, "admin.leads.reschedule");
  }
}
