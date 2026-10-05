import { NextResponse } from "next/server";
import { getBookingProvider } from "@/lib/booking/server";
import { BookingError, friendly } from "@/lib/booking/errors";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { addMinutes, formatTimeLabel } from "@/lib/booking/dates";
import { getBundle } from "@/config/bundles";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** POST /api/booking/create: validates on the server, then books through the active provider. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message && first.message.length < 120 ? first.message : "Please check your details and try again.", code: "invalid_request" }, { status: 400 });
  }
  const r = parsed.data;
  const bundle = getBundle(r.bundleId)!;
  // The server decides the session length; the browser's end time is never trusted.
  const end = addMinutes(r.slot.start, bundle.durationMinutes);
  try {
    const booking = await getBookingProvider().createBooking({
      bundleId: r.bundleId,
      slot: { id: `${r.slot.date}T${r.slot.start}`, date: r.slot.date, start: r.slot.start, end, label: formatTimeLabel(r.slot.start) },
      contact: r.contact,
      address: r.address,
      inspirationPhotoId: r.inspirationPhotoId,
      requestId: r.requestId,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("api.create", "Unexpected error", { error: err as Error });
    return NextResponse.json({ error: friendly.server, code: "server_error" }, { status: 500 });
  }
}
