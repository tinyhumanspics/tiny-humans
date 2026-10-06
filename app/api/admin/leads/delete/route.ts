import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { BookingError } from "@/lib/booking/errors";
import { deleteLeadPermanently, getLeadRow } from "@/lib/leads/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
const body = z.object({ reference: z.string().trim().min(3).max(40), confirm: z.literal("DELETE") });

/** Owner only: permanently delete a lead. Requires {confirm: "DELETE"} (sent by the confirmation dialog). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please confirm the permanent delete." }, { status: 400 });
  const row = await getLeadRow(p.data.reference).catch(() => null);
  if (!row) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  try {
    await deleteLeadPermanently(row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: `Nothing was deleted: ${err.message}` }, { status: err.status });
    log.error("admin.leads", "Delete failed", { error: err as Error, reference: row.bookingReference });
    return NextResponse.json({ error: "The booking was cancelled (calendar cleared) but couldn't be removed. Please try Delete again." }, { status: 500 });
  }
}
