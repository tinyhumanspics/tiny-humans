import { NextResponse, after } from "next/server";
import { z } from "zod";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { afterBackdropChange, getBackdropView, saveBackdropsWithToken } from "@/lib/booking/backdrop-page";
import { backdropPicks } from "@/lib/booking/validation";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET ?t=<management token>: the booking's backdrop picks and how many it can have. */
export async function GET(req: Request) {
  if (!(await allow("manageGet", clientIp(req)))) return tooMany();
  const token = new URL(req.url).searchParams.get("t");
  if (!tokenOk(token)) return invalidLink();
  try {
    return NextResponse.json({ backdrop: await getBackdropView(token) }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.backdrop.get");
  }
}

const body = z.object({ token: z.string(), picks: backdropPicks });

/** POST {token, picks}: the family picks or changes their backdrop (until the day before the session). */
export async function POST(req: Request) {
  if (!(await allow("managePost", clientIp(req)))) return tooMany();
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Pick a backdrop.", code: "invalid_request" }, { status: 400, headers: NO_STORE });
  if (!tokenOk(p.data.token)) return invalidLink();
  try {
    const { view, row, before } = await saveBackdropsWithToken(p.data.token, p.data.picks);
    // studio email + Outlook event, after the response (never slows down or fails the save)
    if (before.join() !== p.data.picks.join()) after(() => afterBackdropChange(row, before, p.data.picks));
    return NextResponse.json({ backdrop: view }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.backdrop.post");
  }
}
