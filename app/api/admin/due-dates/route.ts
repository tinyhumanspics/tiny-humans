import { NextResponse } from "next/server";
import { z } from "zod";
import { babyAgeOptions } from "@/config/booking";
import { isAdmin } from "@/lib/admin/auth";
import { formatTimeLabel } from "@/lib/booking/dates";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { isDatabaseConfigured } from "@/lib/db/client";
import { cancelDueReservation, dueById, listDueReservations, remindDueDeposit } from "@/lib/due-date/server";
import { log } from "@/lib/log";
import { isDateKey } from "@/lib/validation/date-key";

export const dynamic = "force-dynamic";

const NO_TABLE = "The due-date table isn't in the database yet. Run drizzle/0026_due_dates.sql in Neon.";

async function guard() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "The database isn't connected yet." }, { status: 503 });
  return null;
}

const list = async () => {
  const reservations = await listDueReservations();
  return reservations ? { reservations, ready: true } : { reservations: [], ready: false, error: NO_TABLE };
};

/** Owner only: every due-date reservation ("Not born yet"). */
export async function GET() {
  const g = await guard(); if (g) return g;
  try {
    return NextResponse.json(await list(), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn't load the due dates." }, { status: 500 });
  }
}

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("book"),
    id: z.string().uuid(),
    date: z.string().refine(isDateKey, "Pick a day."),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time."),
    babyAge: z.enum(babyAgeOptions as unknown as [string, ...string[]]),
    babyName: z.string().trim().max(80).optional(),
  }),
  z.object({ action: z.literal("cancel"), id: z.string().uuid(), refund: z.boolean() }),
  z.object({ action: z.literal("remind"), id: z.string().uuid() }),
]);

/**
 * Owner only. "book": the owner picks the session for a reservation (the baby arrived and the family texted): a normal
 * booking with the kept price and no new deposit; the family gets the usual confirmation email.
 * "cancel": ends a reservation that has no booking yet, refunding its deposit on Stripe when asked.
 * "remind" (Leads → Not paid): emails the family a link to pay the missing deposit; their details stay saved.
 */
export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Check the details." }, { status: 400 });
  const input = p.data;
  try {
    if (input.action === "remind") {
      await remindDueDeposit(input.id);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "cancel") {
      const result = await cancelDueReservation(input.id, input.refund);
      return NextResponse.json({ ...(await list()), ...result });
    }
    const due = await dueById(input.id);
    if (!due) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    const babies = Array.from({ length: due.babyCount }, (_, i) => ({ age: input.babyAge, name: i === 0 ? input.babyName || undefined : undefined }));
    const booking = await getBookingProvider().createBooking({
      bundleId: due.packageId,
      locale: due.locale,
      babies,
      slot: { id: `${input.date}T${input.start}`, date: input.date, start: input.start, end: "", label: formatTimeLabel(input.start) },
      contact: { parentName: due.parentName, email: due.email, phone: due.phone, babyName: input.babyName || undefined, babyAge: input.babyAge, notes: due.notes ?? undefined },
      address: { street: due.street, unit: due.unit ?? undefined, city: due.city, zip: due.zip },
      // one booking per reservation, even if this is sent twice
      requestId: `due-${due.id}`,
      dueReservationId: due.id,
    });
    log.info("admin.due", "Owner booked a due-date reservation", { reference: booking.id });
    return NextResponse.json({ ...(await list()), booked: booking.id });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    log.error("admin.due", "Due-date action failed", { error: err as Error });
    return NextResponse.json({ error: "Couldn't do that just now. Please try again." }, { status: 500 });
  }
}
