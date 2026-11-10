import { NextResponse } from "next/server";
import { bodyOf, NO_STORE, parsed, shootsError, shootsGuard } from "@/lib/shoots/route";
import { clearTicks, getTicks, setTick } from "@/lib/shoots/server";
import { dateSchema, tickSchema } from "@/lib/shoots/validation";

export const dynamic = "force-dynamic";

/** Owner only: the ticked keys of a day (?date=YYYY-MM-DD). */
export async function GET(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const date = await parsed(dateSchema, new URL(req.url).searchParams.get("date"));
  if ("response" in date) return date.response;
  try {
    return NextResponse.json({ ticks: await getTicks(date.data) }, { headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "ticks");
  }
}

/** Owner only: tick or untick one line ({ date, key, on }); both phones can send the same tick. */
export async function POST(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const input = await parsed(tickSchema, await bodyOf(req));
  if ("response" in input) return input.response;
  try {
    await setTick(input.data.date, input.data.key, input.data.on);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "tick");
  }
}

/** Owner only: "Clear all ticks" for a day (?date=YYYY-MM-DD). */
export async function DELETE(req: Request) {
  const blocked = await shootsGuard(req);
  if (blocked) return blocked;
  const date = await parsed(dateSchema, new URL(req.url).searchParams.get("date"));
  if ("response" in date) return date.response;
  try {
    await clearTicks(date.data);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return shootsError(err, "clear ticks");
  }
}
