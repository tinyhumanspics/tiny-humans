import { NextResponse } from "next/server";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError, friendly } from "@/lib/booking/errors";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { formatTimeLabel } from "@/lib/booking/dates";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/booking/create: validates on the server, then books through the active provider. */
export async function POST(req: Request) {
  if (!(await allow("create", clientIp(req)))) {
    return NextResponse.json({ error: "Too many booking attempts from this connection. Please wait a little, or email hello@tinyhumans.photography and we'll book you in.", code: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message && first.message.length < 120 ? first.message : "Please check your details and try again.", code: "invalid_request" }, { status: 400 });
  }
  const r = parsed.data;
  // Spam: a filled hidden field, or a booking finished faster than a person can read the form (direct API calls
  // without timing are allowed: older open pages don't send it).
  const spam = Boolean(r.hp?.trim()) || (r.elapsedMs !== undefined && r.elapsedMs < 4000);
  if (spam) {
    log.warn("booking.spam", "Booking refused (spam signals)", { honeypot: Boolean(r.hp?.trim()), elapsedMs: r.elapsedMs });
    return NextResponse.json({ error: "We couldn't confirm this booking automatically. Please try again, or email hello@tinyhumans.photography and we'll book you in.", code: "invalid_request" }, { status: 400 });
  }
  // The server decides the session length and price; the browser's end time and prices are never trusted.
  try {
    const booking = await getBookingProvider().createBooking({
      bundleId: r.bundleId,
      slot: { id: `${r.slot.date}T${r.slot.start}`, date: r.slot.date, start: r.slot.start, end: "", label: formatTimeLabel(r.slot.start) },
      contact: r.contact,
      address: r.address,
      inspirationPhotoId: r.inspirationPhotoId,
      requestId: r.requestId,
      discountCode: r.discountCode,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.create", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: friendly.server, code: "server_error" }, { status: 500 });
  }
}
