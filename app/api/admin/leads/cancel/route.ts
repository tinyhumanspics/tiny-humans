import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { cancelBookingRow } from "@/lib/booking/cancellation";
import { BookingError } from "@/lib/booking/errors";
import { getLead, getLeadRow } from "@/lib/leads/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().trim().min(3).max(40),
  reason: z.string().trim().min(3, "Add a cancellation reason.").max(1000),
});

/** Owner only: cancel a booking on the customer's behalf (reason required). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Add a cancellation reason." }, { status: 400 });
  try {
    const row = await getLeadRow(parsed.data.reference);
    if (!row) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    await cancelBookingRow(row, { reason: parsed.data.reason, by: "admin" });
    log.info("admin.leads", "Admin cancelled booking", { reference: row.bookingReference });
    return NextResponse.json({ lead: await getLead(row.bookingReference) });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.leads", "Admin cancellation failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't cancel. Please try again." }, { status: 500 });
  }
}
