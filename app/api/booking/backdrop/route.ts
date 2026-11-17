import { NextResponse, after } from "next/server";
import { z } from "zod";
import { NO_STORE, invalidLink, manageFail, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { afterBackdropChange, getBackdropView, saveBackdropsWithToken } from "@/lib/booking/backdrop-page";
import { backdropPicks, homeInput } from "@/lib/booking/validation";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";

export const dynamic = "force-dynamic";

/** GET ?t=<management token>: what "Prepare for your session" shows (backdrops, home, baby names, photo permission). */
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

const line = (max: number) => z.string().trim().max(max);
const body = z.object({
  token: z.string(),
  picks: backdropPicks,
  // "Prepare for your session": the rest of the page (left out = unchanged)
  home: homeInput.optional(),
  babyNames: z.array(line(80)).max(3).optional(),
  photos: z.boolean().optional(),
});

/** POST {token, picks, home?, babyNames?, photos?}: the family prepares their session (until the day before it). */
export async function POST(req: Request) {
  if (!(await allow("managePost", clientIp(req)))) return tooMany();
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const p = body.safeParse(input);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Pick a backdrop.", code: "invalid_request" }, { status: 400, headers: NO_STORE });
  if (!tokenOk(p.data.token)) return invalidLink();
  try {
    const { token, ...input } = p.data;
    const { view, row, before, changed } = await saveBackdropsWithToken(token, input);
    // studio email + Outlook event, after the response (never slows down or fails the save)
    if (changed) after(() => afterBackdropChange(row, before, input.picks));
    return NextResponse.json({ backdrop: view }, { headers: NO_STORE });
  } catch (err) {
    return manageFail(err, "api.backdrop.post");
  }
}
