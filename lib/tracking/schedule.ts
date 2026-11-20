import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { site } from "@/config/site";
import { homeOf } from "@/lib/booking/details";
import { getDb } from "@/lib/db/client";
import { bookings, type Booking, type BookingRequestRow, type DueDateReservation } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { requestForBooking, requestForDue } from "@/lib/requests/store";
import { sendScheduleEvent, type MetaClient, type ScheduleEvent } from "./meta-capi";
import { latestFbc } from "./normalize";

/**
 * Meta "Schedule" (server, brief 03), once per booking when it's confirmed: the pay-link deposit is paid ("website"),
 * or the owner confirms it with nothing to pay ("chat": confirmed by text). A due-date reservation sends it when its
 * deposit is paid (its later session isn't counted again). When the booking came from a website request, the
 * request's match data is used: the pay link opens in another browser than the ad click. Never throws; sent after the
 * response, never in a batch.
 */

const book = () => `${site.url.replace(/\/$/, "")}/book`;

/** The request's browser (where the ad click was), else the one we have now. */
function clientOf(req: BookingRequestRow | null, now: MetaClient = {}, fbclid?: { id: string; at: Date } | null): MetaClient {
  const ownFbc = fbclid ? `fb.1.${fbclid.at.getTime()}.${fbclid.id}` : undefined;
  return {
    ip: req?.clientIp || now.ip,
    userAgent: req?.userAgent || now.userAgent,
    fbp: req?.fbp || now.fbp,
    fbc: latestFbc(req?.fbc ?? now.fbc, ownFbc),
  };
}

function later(send: () => Promise<void>) {
  const run = () => send().catch((err) => log.error("meta.capi", "Schedule not sent", { error: err as Error }));
  try {
    after(run);
  } catch {
    void run();
  }
}

const totalCents = (row: Booking) => (row.finalPriceCents ?? row.packagePrice * 100) + (row.addonsTotalCents ?? 0) + (row.travelFeeCents ?? 0);

/** A confirmed booking. `client`: the family's browser when they came back from paying (used when there's no request). */
export function scheduleBooking(row: Booking, actionSource: ScheduleEvent["actionSource"], client?: MetaClient) {
  later(async () => {
    const req = await requestForBooking(row.id).catch(() => null);
    const home = homeOf(row.locationAddress);
    await sendScheduleEvent({
      eventId: row.bookingReference,
      actionSource,
      ...(actionSource === "website" ? { eventSourceUrl: book() } : {}),
      value: totalCents(row) / 100,
      bundleId: row.packageId,
      bundleName: row.packageName,
      person: { email: row.email, phone: req?.mobile ?? row.phone, name: row.parentName, zip: home.zip || req?.zip || "", city: home.city },
      client: clientOf(req, client, row.fbclid ? { id: row.fbclid, at: row.firstTouchAt ?? row.createdAt } : null),
    });
  });
}

/** The owner confirmed a request with nothing to pay (Requests with deposits off): by text. */
export async function scheduleOwnerBooked(reference: string): Promise<void> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1).catch(() => []);
  if (row) scheduleBooking(row, "chat");
}

/** A due-date reservation's deposit was paid on our site. */
export function scheduleReservation(row: DueDateReservation) {
  later(async () => {
    const req = await requestForDue(row.id).catch(() => null);
    await sendScheduleEvent({
      eventId: row.reference,
      actionSource: "website",
      eventSourceUrl: book(),
      value: (row.bundlePriceCents + (row.travelFeeCents ?? 0)) / 100,
      bundleId: row.packageId,
      bundleName: row.packageName,
      person: { email: row.email, phone: req?.mobile ?? row.phone, name: row.parentName, zip: row.zip, city: row.city },
      client: clientOf(req),
    });
  });
}
