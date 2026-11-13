import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FAMILY_MEMBERS } from "@/config/booking";
import { isAdmin } from "@/lib/admin/auth";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { getDepositSettings } from "@/lib/deposit/server";
import { depositCentsFor } from "@/lib/deposit/types";
import { log } from "@/lib/log";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";

export const dynamic = "force-dynamic";

const query = z.object({
  bundle: z.string().trim().regex(/^[a-z0-9-]{1,64}$/, "Pick a bundle."),
  babies: z.coerce.number().int().min(1).max(3).default(1),
  family: z.coerce.number().int().min(0).max(MAX_FAMILY_MEMBERS).default(0),
  zip: z.string().trim().regex(/^\d{5}$/).optional(),
  code: z.string().trim().max(40).optional(),
  email: z.string().trim().max(254).optional(),
});

/**
 * Owner only: the price a family would pay (/admin → Quotes / Booking → "Book it for them", owner Nov 12): the bundle
 * with today's special offer, or a discount code when it saves more (only one counts, as on the website), extras,
 * travel for their ZIP code and the deposit. Same functions as the booking form.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const p = query.safeParse(Object.fromEntries(["bundle", "babies", "family", "zip", "code", "email"].map((k) => [k, params.get(k) || undefined])));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the bundle." }, { status: 400 });
  const { bundle, babies, family, zip, code, email } = p.data;
  try {
    const quote = await getBookingProvider().quote(bundle, code, email, babies, family);
    const travel = zip ? travelQuote(zip, await getTravelSettings()) : null;
    const travelCents = travel?.status === "fee" ? travel.feeCents : 0;
    const totalCents = quote.totalCents + travelCents;
    const depositCents = depositCentsFor(totalCents, bundle, await getDepositSettings()) || null;
    return NextResponse.json({ quote, travel, totalCents, depositCents }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("admin.booking", "Owner price failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't work out the price just now. Please try again." }, { status: 500 });
  }
}
