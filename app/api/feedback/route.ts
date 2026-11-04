import { NextResponse } from "next/server";
import { z } from "zod";
import { FEEDBACK_REASONS, unfinishedRules } from "@/config/unfinished";
import { isDatabaseConfigured } from "@/lib/db/client";
import { NO_STORE, invalidLink, tokenOk, tooMany } from "@/lib/booking/manage-api";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import { getFeedbackForm, saveFeedback } from "@/lib/unfinished/server";
import { log } from "@/lib/log";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";

const e = en.feedback.errors;
const body = z
  .object({
    token: z.string(),
    reasons: z.array(z.enum(FEEDBACK_REASONS)).max(FEEDBACK_REASONS.length),
    comment: z.string().trim().max(unfinishedRules.maxCommentLength),
  })
  .refine((v) => v.reasons.length > 0 || v.comment.length > 0, e.reason);

/** GET /api/feedback?token=… : the "What stopped you?" page's data (first name, any earlier answer). */
export async function GET(req: Request) {
  if (!(await allow("feedbackGet", clientIp(req)))) return tooMany();
  const token = new URL(req.url).searchParams.get("token");
  if (!tokenOk(token) || !isDatabaseConfigured()) return invalidLink();
  try {
    const form = await getFeedbackForm(token);
    return form ? NextResponse.json(form, { headers: NO_STORE }) : invalidLink();
  } catch (err) {
    log.error("api.feedback", "Could not load the feedback form", { error: err as Error });
    return NextResponse.json({ error: e.failed }, { status: 500, headers: NO_STORE });
  }
}

/** POST {token, reasons, comment}: saves the family's answer for /admin → Unfinished bookings. */
export async function POST(req: Request) {
  if (!(await allow("feedbackPost", clientIp(req)))) return tooMany();
  const raw = await readJson(req, BODY_LIMITS.review);
  if (raw === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const parsed = body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? e.failed }, { status: 400, headers: NO_STORE });
  const { token, reasons, comment } = parsed.data;
  if (!tokenOk(token) || !isDatabaseConfigured()) return invalidLink();
  try {
    return (await saveFeedback(token, reasons, comment)) ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : invalidLink();
  } catch (err) {
    log.error("api.feedback", "Could not save the feedback", { error: err as Error });
    return NextResponse.json({ error: e.failed }, { status: 500, headers: NO_STORE });
  }
}
