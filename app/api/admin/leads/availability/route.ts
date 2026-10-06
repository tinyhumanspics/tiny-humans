import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getLeadRow } from "@/lib/leads/server";
import { rescheduleAvailability } from "@/lib/booking/reschedule";
import { manageFail } from "@/lib/booking/manage-api";

export const dynamic = "force-dynamic";

/** Owner only: open times for moving a lead (its own slot never blocks itself). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const u = new URL(req.url);
  const [reference, from, to] = ["reference", "from", "to"].map((k) => u.searchParams.get(k) ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  try {
    const row = await getLeadRow(reference);
    if (!row) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ days: await rescheduleAvailability(row, from, to) });
  } catch (err) {
    return manageFail(err, "admin.leads.availability");
  }
}
