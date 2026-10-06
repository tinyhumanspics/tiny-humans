import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { BookingError } from "@/lib/booking/errors";
import { log } from "@/lib/log";
import { deleteCode, listCodes, saveCode } from "@/lib/pricing/server";
import { codeInputSchema } from "@/lib/pricing/validation";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet. Add DATABASE_URL and run the Neon migration." }, { status: 503 });
  return null;
}

/** Owner only: create or update a discount code. */
export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  const p = codeInputSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the code details." }, { status: 400 });
  try {
    await saveCode(p.data);
    return NextResponse.json({ codes: await listCodes() });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.pricing", "Save code failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't save the code." }, { status: 500 });
  }
}

/** Owner only: delete a code (?id=). Bookings keep their own copy of the code and amount. */
export async function DELETE(req: Request) {
  const g = await guard(); if (g) return g;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing code." }, { status: 400 });
  try {
    await deleteCode(id);
    return NextResponse.json({ codes: await listCodes() });
  } catch (err) {
    log.error("admin.pricing", "Delete code failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't delete the code." }, { status: 500 });
  }
}
