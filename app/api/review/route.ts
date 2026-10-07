import { NextResponse } from "next/server";
import { z } from "zod";
import { isDatabaseConfigured } from "@/lib/db/client";
import { NO_STORE, invalidLink, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { getReviewForm, saveReview } from "@/lib/reviews/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

const e = en.review.errors;
const body = z.object({
  token: z.string(),
  rating: z.number({ message: e.rating }).int(e.rating).min(1, e.rating).max(5, e.rating),
  body: z.string().trim().min(3, e.body).max(2000),
  displayName: z.string().trim().min(1, e.name).max(60),
  consentPublic: z.boolean(),
});

/** GET /api/review?token=… : the review form's data (first name, suggested display name, any earlier review). */
export async function GET(req: Request) {
  if (!(await allow("reviewGet", clientIp(req)))) return tooMany();
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenOk(token) || !isDatabaseConfigured()) return invalidLink();
  try {
    const form = await getReviewForm(token);
    return form ? NextResponse.json(form, { headers: NO_STORE }) : invalidLink();
  } catch (err) {
    log.error("api.review", "Could not load the review form", { error: err as Error });
    return NextResponse.json({ error: e.failed }, { status: 500, headers: NO_STORE });
  }
}

/** POST {token, rating, body, displayName, consentPublic}: saves the family's review. */
export async function POST(req: Request) {
  if (!(await allow("reviewPost", clientIp(req)))) return tooMany();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? e.failed }, { status: 400, headers: NO_STORE });
  const { token, ...input } = parsed.data;
  if (!tokenOk(token) || !isDatabaseConfigured()) return invalidLink();
  try {
    return (await saveReview(token, input)) ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : invalidLink();
  } catch (err) {
    log.error("api.review", "Could not save the review", { error: err as Error });
    return NextResponse.json({ error: e.failed }, { status: 500, headers: NO_STORE });
  }
}
