import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/auth";
import { daysBetweenDateKeys, isDateKey } from "@/lib/validation/date-key";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const query = z.object({
  bundle: z.string().trim().regex(/^[a-z0-9-]{1,64}$/, "Pick a bundle."),
  babies: z.coerce.number().int().min(1).max(3).default(1),
  zip: z.string().trim().regex(/^\d{5}$/, "Enter the family's 5-digit ZIP code."),
  from: z.string().refine(isDateKey, "Pick a day."),
  to: z.string().refine(isDateKey, "Pick a day."),
});

/** Owner only: open times for booking a family (/admin → Quotes / Booking): the owner's hours, no online minimum notice. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const p = query.safeParse(Object.fromEntries(["bundle", "babies", "zip", "from", "to"].map((k) => [k, params.get(k) ?? undefined])));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the dates." }, { status: 400 });
  const days = daysBetweenDateKeys(p.data.from, p.data.to);
  if (p.data.from > p.data.to || days === null || days > 62) return NextResponse.json({ error: "Choose a shorter date range." }, { status: 400 });
  try {
    const result = await getBookingProvider().getAvailability({ bundleId: p.data.bundle, babyCount: p.data.babies, zip: p.data.zip, from: p.data.from, to: p.data.to }, true);
    return NextResponse.json({ days: result }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    log.error("admin.booking", "Owner availability failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't load the calendar just now. Please try again." }, { status: 500 });
  }
}
