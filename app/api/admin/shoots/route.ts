import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { createStyledShoot, listShootDays } from "@/lib/shoots/server";
import { newStyledShootSchema, rangeSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/** Owner only: shoot days between two Miami days (?from=YYYY-MM-DD&to=YYYY-MM-DD), each with its shoots and ticks. */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const range = await parsed(rangeSchema, { from: params.get("from"), to: params.get("to") });
  if ("response" in range) return range.response;
  try {
    return NextResponse.json({ days: await listShootDays(range.data.from, range.data.to) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "list");
  }
}

/** Owner only: "+ Shoot without a booking" (title, day, start, place). */
export async function POST(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const input = await parsed(newStyledShootSchema, await bodyOf(req));
  if ("response" in input) return input.response;
  try {
    return NextResponse.json({ shoot: await createStyledShoot(input.data) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "create styled");
  }
}
