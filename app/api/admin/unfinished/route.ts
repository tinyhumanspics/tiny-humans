import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db/client";
import { isMissingTable } from "@/lib/deposit/server";
import { log } from "@/lib/log";
import { periodOf } from "@/lib/unfinished/period";
import { deleteDraft, getUnfinishedData, saveMailingAddress } from "@/lib/unfinished/server";

export const dynamic = "force-dynamic";

const notReady = () => NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
const missing = () => NextResponse.json({ error: "The tables for unfinished bookings don't exist yet. Run drizzle/0022_unfinished_bookings.sql in Neon." }, { status: 503 });

/** Owner only: the families who didn't finish booking, their answers, step counts and the mailing address. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return notReady();
  const { days, source } = periodOf(new URL(req.url));
  try {
    return NextResponse.json(await getUnfinishedData(days, source), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("admin.unfinished", "Could not load unfinished bookings", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the list. Please try again." }, { status: 500 });
  }
}

const addressSchema = z.object({ mailingAddress: z.string().trim().max(300, "Keep the address under 300 characters.") });

/** Owner only: save the mailing address shown at the bottom of marketing emails (empty = follow-ups stay off). */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return notReady();
  const parsed = addressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the address." }, { status: 400 });
  const { days, source } = periodOf(new URL(req.url));
  try {
    await saveMailingAddress(parsed.data.mailingAddress);
    return NextResponse.json(await getUnfinishedData(days, source));
  } catch (err) {
    if (isMissingTable(err)) return missing();
    log.error("admin.unfinished", "Could not save the mailing address", { error: err as Error });
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 });
  }
}

/** Owner only: remove one family from the list (e.g. a test or someone who asked). ?id=<uuid> */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return notReady();
  const url = new URL(req.url);
  const id = z.uuid().safeParse(url.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Unknown entry." }, { status: 400 });
  const { days, source } = periodOf(url);
  try {
    await deleteDraft(id.data);
    return NextResponse.json(await getUnfinishedData(days, source));
  } catch (err) {
    if (isMissingTable(err)) return missing();
    log.error("admin.unfinished", "Could not delete an unfinished booking", { error: err as Error });
    return NextResponse.json({ error: "Couldn't remove it. Please try again." }, { status: 500 });
  }
}
