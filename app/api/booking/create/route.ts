import { NextResponse, after } from "next/server";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError, friendly } from "@/lib/booking/errors";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { formatTimeLabel } from "@/lib/booking/dates";
import { log } from "@/lib/log";
import { allow, clientIp } from "@/lib/rate-limit";
import { FBC_COOKIE, SOURCE_COOKIE, decodeAttribution } from "@/lib/tracking/attribution";
import { sendScheduleEvent } from "@/lib/tracking/meta-capi";
import { site } from "@/config/site";
import { scheduleHref } from "@/config/booking";
import { cookies } from "next/headers";

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
  const jar = await cookies();
  try {
    const booking = await getBookingProvider().createBooking({
      bundleId: r.bundleId,
      locale: r.locale,
      babies: r.babies,
      slot: { id: `${r.slot.date}T${r.slot.start}`, date: r.slot.date, start: r.slot.start, end: "", label: formatTimeLabel(r.slot.start) },
      contact: r.contact,
      address: r.address,
      inspirationPhotoId: r.inspirationPhotoId,
      requestId: r.requestId,
      discountCode: r.discountCode,
      consents: r.consents,
      backdrops: r.backdrops,
      // where this family came from (first-party cookie set by proxy.ts; never taken from the request body)
      attribution: decodeAttribution(jar.get(SOURCE_COOKIE)?.value) ?? undefined,
    });
    // Meta Conversions API: after the response is sent, so it can never slow down or fail the booking. A booking
    // waiting on its deposit ("pending") sends it once the deposit is paid (lib/deposit/flow.ts).
    if (booking.status === "confirmed") {
      const referer = req.headers.get("referer");
      const sameSite = referer && new URL(referer, site.url).host === new URL(req.url).host;
      const eventSourceUrl = sameSite ? referer! : `${site.url.replace(/\/$/, "")}${scheduleHref(r.bundleId)}`;
      after(() =>
        sendScheduleEvent({
          eventId: r.requestId ?? booking.id,
          eventSourceUrl,
          value: ((booking.pricing?.totalCents ?? booking.pricing?.finalCents ?? 0) + (booking.travel?.feeCents ?? 0)) / 100,
          bundleId: r.bundleId,
          bundleName: booking.pricing?.bundleName ?? r.bundleId,
          contact: { parentName: r.contact.parentName, email: r.contact.email, phone: r.contact.phone },
          address: { city: r.address.city, zip: r.address.zip },
          client: { ip: ((ip) => (ip === "unknown" ? undefined : ip))(clientIp(req)), userAgent: req.headers.get("user-agent") ?? undefined, fbp: jar.get("_fbp")?.value, fbc: jar.get("_fbc")?.value ?? jar.get(FBC_COOKIE)?.value },
        }),
      );
    }
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.create", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: friendly.server, code: "server_error" }, { status: 500 });
  }
}
