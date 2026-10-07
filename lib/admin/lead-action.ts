import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import type { Booking } from "@/lib/db/schema";
import { BookingError } from "@/lib/booking/errors";
import { getLead, getLeadRow } from "@/lib/leads/server";
import { log } from "@/lib/log";

/** Shared shape of the owner's per-lead actions: sign-in check, body check, find the lead, act, return the fresh lead. */
export async function leadAction<S extends z.ZodType<{ reference: string }>>(req: Request, schema: S, scope: string, act: (row: Booking, input: z.infer<S>) => Promise<void>) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details." }, { status: 400 });
  try {
    const row = await getLeadRow(parsed.data.reference);
    if (!row) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    await act(row, parsed.data);
    return NextResponse.json({ lead: await getLead(row.bookingReference) });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error(scope, "Admin action failed", { error: err as Error });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
