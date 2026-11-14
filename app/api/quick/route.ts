import { NextResponse } from "next/server";
import { site } from "@/config/site";
import { internalQuickRequestEmail } from "@/lib/email";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { getCatalog } from "@/lib/pricing/server";
import { saveQuickRequest } from "@/lib/quick/server";
import { quickRequestSchema } from "@/lib/quick/validation";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export const dynamic = "force-dynamic";

/**
 * POST /api/quick: the quick form (owner, Nov 13: "people sometimes don't want to go through the whole process").
 * Saves the family's details (best effort) and emails the studio, who books it for them in /admin → Quotes / Booking.
 * Parent contact + what they told us only; nothing goes to Meta or analytics. Works before migration 0034 (email only).
 */
export async function POST(req: Request) {
  if (!(await allow("quick", clientIp(req)))) return NextResponse.json({ error: en.quick.errors.rateLimited, code: "rate_limited" }, { status: 429 });
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse();
  const locale = (input as { locale?: unknown } | null)?.locale === "es" ? "es" : "en";
  const t = (locale === "es" ? es : en).quick;
  const parsed = quickRequestSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.message ?? "");
    const message = (t.errors as Record<string, string>)[field] ?? t.errors.check;
    return NextResponse.json({ error: message, code: "invalid_request", field }, { status: 400 });
  }
  const r = parsed.data;
  // spam: a filled hidden field, or a form sent faster than a person can fill it in
  if (r.hp?.trim() || (r.elapsedMs !== undefined && r.elapsedMs < 3000)) {
    log.warn("quick.spam", "Quick request refused (spam signals)", { honeypot: Boolean(r.hp?.trim()), elapsedMs: r.elapsedMs });
    return NextResponse.json({ error: t.errors.check, code: "invalid_request" }, { status: 400 });
  }
  const saved = await saveQuickRequest(r);
  const bundleName = r.bundleId ? ((await getCatalog().catch(() => [])).find((b) => b.id === r.bundleId)?.name ?? null) : null;
  let emailed = false;
  try {
    const mail = await internalQuickRequestEmail({
      parentName: r.parentName,
      phone: r.phone,
      email: r.email,
      zip: r.zip,
      babyName: r.babyName ?? null,
      babyAge: r.babyAge ?? null,
      dueDate: r.babyAge === "Not born yet" ? (r.dueDate ?? null) : null,
      bundleName,
      bestTime: r.bestTime ?? null,
      message: r.message ?? null,
      locale: r.locale,
      adminUrl: `${site.url.replace(/\/$/, "")}/admin/quotes`,
    });
    await sendEmail({ scope: "resend.quick", from: emailConfig().internalFrom, to: emailConfig().notify, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: r.email });
    emailed = true;
  } catch (err) {
    log.error("quick", "Quick request email to the studio not sent", { error: err as Error, saved: Boolean(saved) });
  }
  // neither saved nor emailed: tell them, so they can text instead
  if (!saved && !emailed) return NextResponse.json({ error: t.errors.server, code: "server_error" }, { status: 503 });
  return NextResponse.json({ ok: true }, { status: 201, headers: { "cache-control": "no-store" } });
}
