import { NextResponse } from "next/server";
import { addBlock, deleteBlock, getAvailabilityRules } from "@/lib/availability/server";
import { blockSchema } from "@/lib/availability/validation";
import { availabilityError, guardAvailability } from "@/lib/availability/api";

export const dynamic = "force-dynamic";

/** Owner only: block a time period. */
export async function POST(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const parsed = blockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the times and try again." }, { status: 400 });
  try {
    await addBlock(parsed.data);
    return NextResponse.json({ rules: await getAvailabilityRules() });
  } catch (err) {
    return availabilityError(err, "add time block");
  }
}

/** Owner only: remove a time block (?id=<uuid>). */
export async function DELETE(req: Request) {
  const blocked = await guardAvailability();
  if (blocked) return blocked;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing time block." }, { status: 400 });
  try {
    await deleteBlock(id);
    return NextResponse.json({ rules: await getAvailabilityRules() });
  } catch (err) {
    return availabilityError(err, "delete time block");
  }
}
