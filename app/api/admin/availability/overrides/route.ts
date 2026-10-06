import { NextResponse } from "next/server";
import { deleteOverride, getAvailabilityRules, upsertOverride } from "@/lib/availability/server";
import { overrideSchema } from "@/lib/availability/validation";
import { availabilityError, guardAvailability } from "@/lib/availability/api";

export const dynamic = "force-dynamic";

/** Owner only: add or update a special date. */
export async function POST(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = overrideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the date and try again." }, { status: 400 });
  try {
    await upsertOverride(parsed.data);
    return NextResponse.json({ rules: await getAvailabilityRules() });
  } catch (err) {
    return availabilityError(err, "save special date");
  }
}

/** Owner only: remove a special date (?date=YYYY-MM-DD). */
export async function DELETE(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Missing date." }, { status: 400 });
  try {
    await deleteOverride(date);
    return NextResponse.json({ rules: await getAvailabilityRules() });
  } catch (err) {
    return availabilityError(err, "delete special date");
  }
}
