import { NextResponse } from "next/server";
import { BookingError } from "@/lib/booking/errors";
import { createDueReservation } from "@/lib/due-date/server";
import { dueRequestSchema } from "@/lib/due-date/validation";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

export const dynamic = "force-dynamic";

/** POST /api/due-date: a "Not born yet" reservation. Price, travel and deposit are worked out on the server. */
export async function POST(req: Request) {
  const body = await readJson(req, BODY_LIMITS.booking);
  if (body === TOO_LARGE) return tooLargeResponse();
  const t = ((body as { locale?: string } | null)?.locale === "es" ? es : en).dueDate.errors;
  if (!(await allow("due", clientIp(req)))) return NextResponse.json({ error: t.rateLimited, code: "rate_limited" }, { status: 429 });
  const parsed = dueRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message && first.message.length < 120 ? first.message : t.server, code: "invalid_request" }, { status: 400 });
  }
  const r = parsed.data;
  // spam: a filled hidden field, or a form finished faster than a person can fill it in
  if (r.hp?.trim() || (r.elapsedMs !== undefined && r.elapsedMs < 4000)) {
    log.warn("due.spam", "Reservation refused (spam signals)", { honeypot: Boolean(r.hp?.trim()), elapsedMs: r.elapsedMs });
    return NextResponse.json({ error: t.spam, code: "invalid_request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createDueReservation(r), { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.due", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: t.server, code: "server_error" }, { status: 500 });
  }
}
