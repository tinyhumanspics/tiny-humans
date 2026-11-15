import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { BookingError } from "@/lib/booking/errors";
import { log } from "@/lib/log";
import { errorCode, reportFailure } from "@/lib/monitoring/report";
import { allow, clientIp } from "@/lib/rate-limit";
import { createRequest, sendRequestEmails } from "@/lib/requests/server";
import { requestSchema } from "@/lib/requests/validation";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import { clientContext } from "@/lib/deposit/request";
import { LAST_TOUCH_COOKIE, SOURCE_COOKIE, decodeAttribution } from "@/lib/tracking/attribution";
import { countFunnelStep } from "@/lib/unfinished/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** POST /api/booking/request ("Send request", brief 02): saves the request (nothing is paid) and emails both sides. */
export async function POST(req: Request) {
  const body = await readJson(req, BODY_LIMITS.small);
  if (body === TOO_LARGE) return tooLargeResponse();
  const t = ((body as { locale?: string } | null)?.locale === "es" ? es : en).bookingRequest.details.errors;
  if (!(await allow("request", clientIp(req)))) return NextResponse.json({ error: t.rateLimited, code: "rate_limited" }, { status: 429, headers: NO_STORE });
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: t.check, code: "invalid_request" }, { status: 400, headers: NO_STORE });
  const r = parsed.data;
  // Spam: a filled hidden box, or a request sent faster than a person can pick a time and type four boxes
  if (r.hp?.trim() || (r.elapsedMs !== undefined && r.elapsedMs < 3000)) {
    log.warn("requests.spam", "Request refused (spam signals)", { honeypot: Boolean(r.hp?.trim()), elapsedMs: r.elapsedMs });
    return NextResponse.json({ error: t.generic, code: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  try {
    const jar = await cookies();
    const source = jar.get(SOURCE_COOKIE)?.value;
    const { sent, row, created, lead } = await createRequest(r, { firstTouch: decodeAttribution(source), lastTouch: decodeAttribution(jar.get(LAST_TOUCH_COOKIE)?.value), client: await clientContext(req) });
    if (created) after(() => Promise.all([sendRequestEmails(row), countFunnelStep("request_sent", row.bundleId, source)]));
    // lead: the browser sends its Pixel Lead with the same event id (the server one goes after this answer)
    return NextResponse.json({ request: sent, lead }, { status: created ? 201 : 200, headers: NO_STORE });
  } catch (err) {
    if (err instanceof BookingError && err.status < 500) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
    // a family tried to send a request and couldn't: the owner hears about it within a minute (brief 01)
    await reportFailure("booking", `A booking request from the website failed (${err instanceof BookingError ? err.code : errorCode(err)})`, { severity: "critical" });
    log.error("requests", "Request failed", { error: err as Error });
    return NextResponse.json({ error: t.generic, code: "server_error" }, { status: err instanceof BookingError ? err.status : 500, headers: NO_STORE });
  }
}
