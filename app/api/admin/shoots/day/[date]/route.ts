import { NextResponse } from "next/server";
import { NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { getDaySheet } from "@/lib/shoots/server";
import { dateSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/** Owner only: everything the day sheet shows (shoots, inspo, ticks, sunset, What to bring). Polled every ~10 s. */
export async function GET(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const date = await parsed(dateSchema, (await params).date);
  if ("response" in date) return date.response;
  try {
    return NextResponse.json({ day: await getDaySheet(date.data) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "day sheet");
  }
}
