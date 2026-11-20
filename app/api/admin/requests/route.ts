import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { BookingError } from "@/lib/booking/errors";
import { isUndefinedTable } from "@/lib/db/client";
import type { BookingRequestRow } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { errorCode, reportFailure } from "@/lib/monitoring/report";
import { confirmRequest, declineRequest } from "@/lib/requests/confirm";
import { deleteRequest, listRequests, madeFor } from "@/lib/requests/store";
import { helloText, requestWhenText } from "@/lib/requests/texts";
import { formatUsMobile, type RequestListItem, type RequestStatus, type RequestType } from "@/lib/requests/types";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import { isDateKey } from "@/lib/validation/date-key";
import { OWNER_SOURCES, isOwnerSource } from "@/config/booking";
import { linksForRequests } from "@/lib/booking-links/server";
import type { BookingLinkRow } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" } as const;

const itemOf = (r: BookingRequestRow, made: RequestListItem["made"], link?: BookingLinkRow): RequestListItem => {
  const locale = r.locale === "es" ? "es" : "en";
  return {
    id: r.id,
    reference: r.reference,
    createdAt: r.createdAt.toISOString(),
    locale,
    type: r.type as RequestType,
    status: r.status as RequestStatus,
    bundleId: r.bundleId,
    bundleName: r.bundleName,
    babyCount: r.babyCount,
    totalCents: r.totalCents,
    travelStatus: r.travelStatus,
    travelMiles: r.travelMiles,
    travelFeeCents: r.travelFeeCents,
    slotDate: r.slotDate,
    slotStart: r.slotStart,
    dueDate: r.dueDate,
    holdUntil: r.holdUntil?.toISOString() ?? null,
    firstName: r.firstName,
    mobile: formatUsMobile(r.mobile),
    email: r.email,
    zip: r.zip,
    textConsent: r.textConsent,
    made,
    hello: helloText(r.firstName, requestWhenText(r, locale), locale),
    link: link ? { source: isOwnerSource(link.source) ? OWNER_SOURCES[link.source] : link.source, babies: link.babies } : null,
  };
};

/** Owner only: the website's booking requests, newest first (/admin → Requests). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  try {
    const rows = await listRequests();
    const [made, links] = await Promise.all([madeFor(rows), linksForRequests(rows.map((r) => r.id))]);
    const requests = rows.map((r) => itemOf(r, (r.bookingId && made.bookings.get(r.bookingId)) || (r.dueId && made.dues.get(r.dueId)) || null, links.get(r.id)));
    return NextResponse.json({ requests }, { headers: NO_STORE });
  } catch (err) {
    if (isUndefinedTable(err)) return NextResponse.json({ requests: [], notReady: "The requests table isn't in the database yet: it arrives with the next deploy." }, { headers: NO_STORE });
    log.error("admin.requests", "Requests not loaded", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the requests." }, { status: 500, headers: NO_STORE });
  }
}

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    id: z.string().uuid(),
    /** "Other time": the day and time the owner picked instead. */
    slot: z.object({ date: z.string().refine(isDateKey, "Pick a day."), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time.") }).optional(),
  }),
  z.object({ action: z.literal("decline"), id: z.string().uuid(), email: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

/**
 * Owner only. "confirm": books the request (or the day and time picked with Other time) and returns the pay link and
 * the text to send. "decline": ends it, optionally with a polite email. "delete": removes it for good (tests).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const p = body.safeParse(input);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the request." }, { status: 400, headers: NO_STORE });
  try {
    if (p.data.action === "delete") return NextResponse.json({ deleted: await deleteRequest(p.data.id) }, { headers: NO_STORE });
    if (p.data.action === "decline") return NextResponse.json(await declineRequest(p.data.id, { email: p.data.email }), { headers: NO_STORE });
    return NextResponse.json(await confirmRequest(p.data.id, p.data.slot), { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err instanceof BookingError && err.status < 500) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
    await reportFailure("booking", `Request ${p.data.action} failed (${err instanceof BookingError ? err.code : errorCode(err)})`, { severity: "critical" });
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
    log.error("admin.requests", "Request action failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't do that just now. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
