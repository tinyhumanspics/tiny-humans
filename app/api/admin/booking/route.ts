import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { formatTimeLabel } from "@/lib/booking/dates";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { isDatabaseConfigured } from "@/lib/db/client";
import { ownerBookingLink } from "@/lib/deposit/flow";
import { OWNER_HOLD_HOURS, OWNER_REQUEST_PREFIX } from "@/lib/deposit/types";
import { log } from "@/lib/log";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Owner only: /admin → Quotes / Booking (owner, Nov 12: moms who text us to book for them). Books the session on the
 * family's behalf with the booking form's own rules and prices (no spam checks, no online minimum notice, no Meta
 * events). With deposits on, the time is held 48 hours and the family gets a link to pick their backdrops and pay;
 * paid → Confirmed, not paid → Leads → Not paid. Body: the booking form's fields + `email` (send the link now).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503, headers: NO_STORE });
  const provider = getBookingProvider();
  if (provider.name !== "outlook") return NextResponse.json({ error: "Booking for a family needs the real calendar (BOOKING_PROVIDER=outlook)." }, { status: 503, headers: NO_STORE });
  const input = await readJson(req, BODY_LIMITS.booking);
  if (input === TOO_LARGE) return tooLargeResponse();
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  const r = parsed.data;
  const email = (input as { email?: unknown }).email !== false;
  try {
    const booking = await provider.createBooking(
      {
        bundleId: r.bundleId,
        locale: r.locale,
        babies: r.babies,
        family: r.family,
        slot: { id: `${r.slot.date}T${r.slot.start}`, date: r.slot.date, start: r.slot.start, end: "", label: formatTimeLabel(r.slot.start) },
        contact: r.contact,
        address: r.address,
        // the form's id keeps a double-click from booking twice; the prefix marks it as booked by the owner
        requestId: `${OWNER_REQUEST_PREFIX}${r.requestId ?? randomUUID()}`,
        discountCode: r.discountCode,
        backdrops: r.backdrops,
      },
      { holdHours: OWNER_HOLD_HOURS },
    );
    const base = { reference: booking.id, pricing: booking.pricing ?? null, travel: booking.travel ?? null };
    if (booking.status === "pending" && booking.deposit?.status === "pending") {
      return NextResponse.json({ ...base, status: "pending", ...(await ownerBookingLink(booking.id, { email })) }, { status: 201, headers: NO_STORE });
    }
    // deposits off (or Stripe down): confirmed right away, with the usual confirmation email
    return NextResponse.json({ ...base, status: "confirmed", emailed: Boolean(booking.emailSent) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status, headers: NO_STORE });
    log.error("admin.booking", "Owner booking failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't book it just now. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
