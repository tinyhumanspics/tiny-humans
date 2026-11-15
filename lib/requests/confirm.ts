import "server-only";
import { eq } from "drizzle-orm";
import { requestDeclinedEmail } from "@/emails/RequestDeclined";
import { formatTimeLabel } from "@/lib/booking/dates";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { getDb } from "@/lib/db/client";
import { bookings, type BookingRequestRow } from "@/lib/db/schema";
import { ownerBookingLink } from "@/lib/deposit/flow";
import { OWNER_HOLD_HOURS, OWNER_REQUEST_PREFIX } from "@/lib/deposit/types";
import { reserveDueForRequest } from "@/lib/due-date/server";
import { emailConfig, EmailSendError, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { getSiteSettings } from "@/lib/settings/server";
import { claimRequest, declineRequest as decline, linkRequest, requestById, unclaimRequest } from "./store";
import { confirmText, requestWhenText } from "./texts";
import { formatUsMobile, type RequestConfirmed } from "./types";

/**
 * The owner's buttons on a request (/admin → Requests, brief 02). "Confirm & send pay link" books it through the
 * existing owner path: a day and time → a booking held 48 h with the family's pay link (backdrops + deposit), the
 * deposit-link email and a prefilled text; a due date → a due-date reservation with its deposit link. "Other time" is
 * the same with the day and time the owner picked.
 */

const localeOf = (r: BookingRequestRow) => (r.locale === "es" ? "es" : "en");

export async function confirmRequest(id: string, slot?: { date: string; start: string }): Promise<RequestConfirmed> {
  const found = await requestById(id);
  if (!found) throw new BookingError("not_found", "That request isn't here anymore. Refresh the page.");
  const row = await claimRequest(id);
  if (!row) throw new BookingError("invalid_request", found.status === "new" ? "It's being confirmed right now. Refresh the page in a minute." : "This request was already answered. Refresh the page.");
  try {
    const when = slot ?? (row.type === "date" && row.slotDate && row.slotStart ? { date: row.slotDate, start: row.slotStart } : null);
    return when ? await bookSlot(row, when) : await reserveDue(row);
  } catch (err) {
    await unclaimRequest(id);
    throw err;
  }
}

/** A day and time: the owner booking (time held 48 h for the family's link, or confirmed when deposits are off). */
async function bookSlot(row: BookingRequestRow, slot: { date: string; start: string }): Promise<RequestConfirmed> {
  const provider = getBookingProvider();
  if (provider.name !== "outlook") throw new BookingError("not_configured", "Confirming needs the real calendar (BOOKING_PROVIDER=outlook).");
  const locale = localeOf(row);
  const booking = await provider.createBooking(
    {
      bundleId: row.bundleId,
      locale,
      // their baby's age and name, and the street, come later on their "Prepare for your session" page
      babies: Array.from({ length: row.babyCount }, () => ({ age: "" })),
      slot: { id: `${slot.date}T${slot.start}`, date: slot.date, start: slot.start, end: "", label: formatTimeLabel(slot.start) },
      contact: { parentName: row.firstName, email: row.email, phone: formatUsMobile(row.mobile), babyAge: "" },
      address: { street: "", city: "", zip: row.zip },
      // one booking per request (a retry returns it); the prefix marks it as booked by the owner
      requestId: `${OWNER_REQUEST_PREFIX}request-${row.id}`,
    },
    { holdHours: OWNER_HOLD_HOURS },
  );
  const [saved] = await getDb().select({ id: bookings.id }).from(bookings).where(eq(bookings.bookingReference, booking.id)).limit(1);
  if (!saved) throw new BookingError("server_error", "The booking was saved, but the request couldn't be linked to it. Open it in Leads.");
  if (booking.status === "pending" && booking.deposit?.status === "pending") {
    await linkRequest(row.id, { bookingId: saved.id }, "confirmed");
    const link = await ownerBookingLink(booking.id, { email: true });
    const sms = confirmText({ name: row.firstName, locale, slot, depositCents: booking.deposit.amountCents, link: link.url });
    return { reference: booking.id, kind: "booking", status: "pending", url: link.url, holdUntil: link.holdUntil, sms, emailed: link.emailed, emailError: link.emailError };
  }
  // deposits off: confirmed now (calendar event + the usual confirmation email)
  await linkRequest(row.id, { bookingId: saved.id }, "booked");
  return { reference: booking.id, kind: "booking", status: "done", url: null, holdUntil: null, sms: confirmText({ name: row.firstName, locale, slot, depositCents: 0, link: null }), emailed: Boolean(booking.emailSent) };
}

/** A due date: a due-date reservation and its deposit link (reserved right away when deposits are off). */
async function reserveDue(row: BookingRequestRow): Promise<RequestConfirmed> {
  if (!row.dueDate) throw new BookingError("invalid_request", "This request has no due date. Use Other time.");
  const locale = localeOf(row);
  const due = await reserveDueForRequest({ requestId: row.id, bundleId: row.bundleId, babyCount: row.babyCount, dueDate: row.dueDate, firstName: row.firstName, email: row.email, phone: formatUsMobile(row.mobile), zip: row.zip, locale });
  const pending = due.row.depositCents > 0 && due.row.depositStatus !== "paid";
  await linkRequest(row.id, { dueId: due.row.id }, pending ? "confirmed" : "booked");
  const sms = confirmText({ name: row.firstName, locale, due: { date: row.dueDate }, depositCents: pending ? due.row.depositCents : 0, link: due.url });
  return { reference: due.row.reference, kind: "due", status: pending ? "pending" : "done", url: due.url, holdUntil: null, sms, emailed: due.emailed, emailError: due.emailError };
}

/** "Decline": ends the request (its hold goes with it) and, when asked, emails a polite note in their language. */
export async function declineRequest(id: string, opts: { email: boolean }): Promise<{ emailed: boolean; emailError?: string }> {
  const row = await decline(id);
  if (!row) throw new BookingError("invalid_request", "This request was already answered. Refresh the page.");
  if (!opts.email) return { emailed: false };
  const locale = localeOf(row);
  try {
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    const mail = await requestDeclinedEmail({ firstName: row.firstName, when: requestWhenText(row, locale) }, { themeId, locale });
    await sendEmail({ scope: "resend.request_declined", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `request-declined/${row.id}`, reference: row.reference });
    return { emailed: true };
  } catch (err) {
    const code = err instanceof EmailSendError ? err.code : "send_failed";
    log.error("requests", "Decline email not sent", { reference: row.reference, code });
    return { emailed: false, emailError: `The request is declined, but the email wasn't sent (${code}).` };
  }
}
