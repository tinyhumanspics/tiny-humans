import "server-only";
import { eq } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { photographersEmailPhoto } from "@/config/media";
import { site } from "@/config/site";
import { getDb } from "@/lib/db/client";
import { bookings, type Booking } from "@/lib/db/schema";
import { bookingConfirmationEmail, internalNewBookingEmail } from "@/lib/email";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { GraphAuthError } from "@/lib/microsoft/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/microsoft/calendar";
import { GraphError } from "@/lib/microsoft/graph";
import { getSiteSettings } from "@/lib/settings/server";
import type { SiteSettings } from "@/lib/settings/types";
import { BookingError, friendly } from "./errors";
import { manageUrls } from "./reschedule";
import { eventBodyHtml, eventSubject, formatAddress, type BookingDetails } from "./templates";
import { graphLocalDateTime } from "./timezone";

/** Calendar problems become a friendly BookingError (details logged). */
export function asCalendarError(err: unknown, action: string): never {
  if (err instanceof BookingError) throw err;
  if (err instanceof GraphAuthError || err instanceof GraphError) {
    log.error("booking.outlook", `${action}: calendar error`, { error: err });
    throw new BookingError("calendar_unavailable", friendly.calendar);
  }
  log.error("booking.outlook", `${action}: unexpected error`, { error: err as Error });
  throw new BookingError("server_error", friendly.server);
}

/** The "Meet your photographers" photo from /admin (Emails, else About Us) for the confirmation email, absolute URL. */
function photographersPhotoUrl(settings: SiteSettings | null, themeId: string): string | null {
  const src = settings ? photographersEmailPhoto(settings.media, themeId)?.src : undefined;
  if (!src) return null;
  return src.startsWith("/") ? `${site.url.replace(/\/$/, "")}${src}` : src;
}

/**
 * Confirms a saved (pending) booking: Outlook event → "confirmed" in Neon → the family's confirmation + the studio's
 * "new booking" email. Runs right after booking, or once the deposit is paid (from the Stripe webhook or the page the
 * family comes back to). `manageToken`: the token whose hash is on the row (its cancel/reschedule/backdrop links).
 *
 * Throws a BookingError when the event can't be created or the booking can't be marked confirmed (the event is
 * removed again); the row is left as it was and the caller decides what happens to it. Emails never undo the
 * booking: failures are recorded on the row.
 */
export async function confirmBookingRow(row: Booking, details: BookingDetails, opts: { manageToken: string; noticeHours: number }): Promise<{ emailSent: boolean }> {
  const db = getDb();
  let eventId: string;
  try {
    ({ id: eventId } = await createCalendarEvent({
      subject: eventSubject(details),
      bodyHtml: eventBodyHtml(details),
      start: graphLocalDateTime(details.date, details.start),
      end: graphLocalDateTime(details.date, details.end),
      timeZone: bookingRules.graphTimeZone,
      location: details.location ?? formatAddress(details.address),
      transactionId: row.id,
    }));
  } catch (err) {
    asCalendarError(err, "confirm.event");
  }

  try {
    await db.update(bookings).set({ status: "confirmed", outlookEventId: eventId, updatedAt: new Date() }).where(eq(bookings.id, row.id));
  } catch (err) {
    log.error("booking.db", "Confirm update failed; rolling back event", { error: err as Error, reference: row.bookingReference });
    await deleteCalendarEvent(eventId).catch((e) => log.error("booking.outlook", "Rollback event delete failed", { error: e }));
    throw new BookingError("server_error", friendly.server);
  }

  // Emails via Resend: the customer confirmation and the internal "new booking" notification. Emails follow the
  // website theme active right now (e.g. Christmas).
  const settings = await getSiteSettings().catch(() => null);
  const themeId = settings?.themeId ?? "default";
  const photographersPhoto = photographersPhotoUrl(settings, themeId);
  const reason = (err: unknown) => (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
  const [customer, internal] = await Promise.allSettled([
    (async () => {
      const links = manageUrls(opts.manageToken);
      const mail = await bookingConfirmationEmail(details, { themeId, cancelUrl: links.cancel, rescheduleUrl: links.reschedule, backdropUrl: links.backdrop, rescheduleNoticeHours: opts.noticeHours, photographersPhoto, locale: row.locale });
      return sendEmail({
        scope: "resend.customer",
        to: details.contact.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
        replyTo: emailConfig().notify,
        idempotencyKey: `booking-confirmation/${row.bookingReference}`,
        reference: row.bookingReference,
      });
    })(),
    (async () => {
      const mail = await internalNewBookingEmail(details, row.createdAt);
      return sendEmail({
        scope: "resend.internal",
        from: emailConfig().internalFrom,
        to: emailConfig().notify,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: details.contact.email,
        idempotencyKey: `booking-internal/${row.bookingReference}`,
        reference: row.bookingReference,
      });
    })(),
  ]);
  const emailSent = customer.status === "fulfilled";
  const now = new Date();
  await db
    .update(bookings)
    .set({
      confirmationEmailSent: emailSent,
      confirmationEmailSentAt: emailSent ? now : null,
      confirmationEmailError: emailSent ? null : reason((customer as PromiseRejectedResult).reason),
      internalNotificationSent: internal.status === "fulfilled",
      internalNotificationSentAt: internal.status === "fulfilled" ? now : null,
      internalNotificationError: internal.status === "fulfilled" ? null : reason((internal as PromiseRejectedResult).reason),
      updatedAt: now,
    })
    .where(eq(bookings.id, row.id))
    .catch((e) => log.error("booking.db", "Could not record email status", { error: e as Error, reference: row.bookingReference }));

  log.info("booking.outlook", "Booking confirmed", { reference: row.bookingReference, customerEmailSent: emailSent, internalNotificationSent: internal.status === "fulfilled", deposit: details.deposit?.status ?? "none" });
  return { emailSent };
}
