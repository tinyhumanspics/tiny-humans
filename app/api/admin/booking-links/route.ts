import { NextResponse } from "next/server";
import { bookingRules } from "@/config/booking";
import { isAdmin } from "@/lib/admin/auth";
import { createBookingLink } from "@/lib/booking-links/server";
import { bookingLinkInput } from "@/lib/booking-links/types";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { todayInZone } from "@/lib/booking/timezone";
import { isDatabaseConfigured } from "@/lib/db/client";
import { log } from "@/lib/log";
import { linkText } from "@/lib/requests/texts";
import { BODY_LIMITS, TOO_LARGE, readJson, tooLargeResponse } from "@/lib/security/body";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Owner only: /admin → Quotes / Booking → "Send a booking link" (owner, Nov 19). Saves the session the family agreed
 * with the owner (bundle, babies, ZIP, day, optional time) and returns their link plus a text with it.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503, headers: NO_STORE });
  const input = await readJson(req, BODY_LIMITS.small);
  if (input === TOO_LARGE) return tooLargeResponse(NO_STORE);
  const p = bookingLinkInput.safeParse(input);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the form." }, { status: 400, headers: NO_STORE });
  const link = p.data;
  if (link.date < todayInZone(bookingRules.timeZone)) return NextResponse.json({ error: "Pick a day from today on." }, { status: 400, headers: NO_STORE });
  const travel = travelQuote(link.zip, await getTravelSettings());
  if (travel.status === "outside_florida") return NextResponse.json({ error: "That ZIP code isn't in Florida." }, { status: 400, headers: NO_STORE });
  if (travel.status === "too_far") return NextResponse.json({ error: `That ZIP code is ${travel.miles} miles away, past your travel limit (/admin → Pricing).` }, { status: 400, headers: NO_STORE });
  try {
    // the bundle exists, is on, and takes this many babies (the same check the request makes)
    await getBookingProvider().quote(link.bundleId, undefined, undefined, link.babies.length);
    const { url } = await createBookingLink(link);
    return NextResponse.json({ url, text: linkText({ locale: link.locale, date: link.date, start: link.start ?? null, link: url }) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err instanceof BookingError && err.status < 500) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    log.error("admin.booking-links", "Link not made", { error: err as Error });
    return NextResponse.json({ error: "Couldn't make the link just now. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
