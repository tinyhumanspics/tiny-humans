import "server-only";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { getBundle } from "@/config/bundles";
import { portfolio } from "@/config/portfolio";
import { getSiteSettings } from "@/lib/settings/server";
import { getDb, isDatabaseConfigured, isUniqueViolation } from "@/lib/db/client";
import { bookings, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { GraphAuthError } from "@/lib/microsoft/auth";
import { GraphError } from "@/lib/microsoft/graph";
import { createCalendarEvent, deleteCalendarEvent, getBusyIntervals, moveCalendarEvent } from "@/lib/microsoft/calendar";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { isMicrosoftConfigured, microsoftConfig } from "@/lib/microsoft/config";
import { availabilityForRange, slotsForDay, type Busy } from "./availability";
import { getAvailabilityRules } from "@/lib/availability/server";
import { BookingError, friendly } from "./errors";
import { addMinutes } from "./dates";
import { generateBookingReference } from "./reference";
import { confirmationEmail, eventBodyHtml, eventSubject, formatAddress, internalNotificationEmail, type BookingDetails } from "./templates";
import { addDaysKey, graphLocalDateTime, zonedTimeToUtc } from "./timezone";
import type { AvailabilityQuery, BookingProvider, BookingRequest, BookingResult, DayAvailability, TimeSlot } from "./types";

const ACTIVE = ne(bookings.status, "cancelled");

function asCalendarError(err: unknown, action: string): never {
  if (err instanceof BookingError) throw err;
  if (err instanceof GraphAuthError || err instanceof GraphError) {
    log.error("booking.outlook", `${action}: calendar error`, { error: err });
    throw new BookingError("calendar_unavailable", friendly.calendar);
  }
  log.error("booking.outlook", `${action}: unexpected error`, { error: err as Error });
  throw new BookingError("server_error", friendly.server);
}

/**
 * Real bookings: Outlook Calendar + Outlook email (Microsoft Graph), stored in Neon.
 * Active when BOOKING_PROVIDER=outlook.
 */
export class OutlookBookingProvider implements BookingProvider {
  readonly name = "outlook";

  private ensureConfigured() {
    if (!isMicrosoftConfigured() || !isDatabaseConfigured()) {
      log.error("booking.outlook", "Outlook provider selected but not configured", {
        microsoft: isMicrosoftConfigured(),
        database: isDatabaseConfigured(),
      });
      throw new BookingError("not_configured", friendly.notConfigured);
    }
  }

  /** Busy time = Outlook calendar events + active bookings in Neon (belt and braces). */
  private async busyBetween(fromDate: string, toDate: string): Promise<Busy[]> {
    const tz = bookingRules.timeZone;
    const from = zonedTimeToUtc(addDaysKey(fromDate, -1), "00:00", tz);
    const to = zonedTimeToUtc(addDaysKey(toDate, 2), "00:00", tz);
    const [calendar, rows] = await Promise.all([
      getBusyIntervals(from, to),
      getDb()
        .select({ start: bookings.sessionStart, end: bookings.sessionEnd })
        .from(bookings)
        .where(and(ACTIVE, gte(bookings.sessionDate, addDaysKey(fromDate, -1)), lte(bookings.sessionDate, addDaysKey(toDate, 1)))),
    ]);
    return [...calendar, ...rows.map((r) => ({ start: r.start, end: r.end }))];
  }

  async getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
    this.ensureConfigured();
    const bundle = getBundle(query.bundleId);
    if (!bundle) throw new BookingError("invalid_request", "Choose a bundle first.");
    try {
      const [rules, busy] = await Promise.all([getAvailabilityRules(), this.busyBetween(query.from, query.to)]);
      return availabilityForRange(query.from, query.to, bundle.durationMinutes, busy, rules);
    } catch (err) {
      asCalendarError(err, "getAvailability");
    }
  }

  async createBooking(request: BookingRequest): Promise<BookingResult> {
    this.ensureConfigured();
    const db = getDb();
    const bundle = getBundle(request.bundleId);
    if (!bundle) throw new BookingError("invalid_request", "Choose a bundle first.");
    const tz = bookingRules.timeZone;
    const { calendarUser } = microsoftConfig();
    const date = request.slot.date;
    const start = request.slot.start;
    const end = addMinutes(start, bundle.durationMinutes);

    // 1. Same submission retried (double-click, flaky network): return the original booking.
    if (request.requestId) {
      const [existing] = await db.select().from(bookings).where(eq(bookings.requestId, request.requestId)).limit(1);
      if (existing && existing.status !== "cancelled" && existing.outlookEventId) return this.toResult(existing, request);
    }

    // 2. Re-check availability against the live calendar.
    let busy: Busy[];
    let rules: Awaited<ReturnType<typeof getAvailabilityRules>>;
    try {
      [rules, busy] = await Promise.all([getAvailabilityRules(), this.busyBetween(date, date)]);
    } catch (err) {
      asCalendarError(err, "createBooking.recheck");
    }
    if (!slotsForDay(date, bundle.durationMinutes, busy, rules).some((s) => s.start === start)) {
      throw new BookingError("slot_unavailable", friendly.slotTaken);
    }

    // 3. Save as pending (unique index on start time blocks a simultaneous double booking).
    const sessionStart = zonedTimeToUtc(date, start, tz);
    const sessionEnd = zonedTimeToUtc(date, end, tz);
    let row: Booking | undefined;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      try {
        [row] = await db
          .insert(bookings)
          .values({
            bookingReference: generateBookingReference(),
            requestId: request.requestId,
            packageId: bundle.id,
            packageName: bundle.name,
            packagePrice: bundle.price,
            parentName: request.contact.parentName,
            email: request.contact.email,
            phone: request.contact.phone,
            babyName: request.contact.babyName ?? null,
            babyAge: request.contact.babyAge,
            locationType: "client_home",
            locationAddress: formatAddress(request.address),
            sessionDate: date,
            sessionStart,
            sessionEnd,
            timezone: tz,
            notes: request.contact.notes ?? null,
            inspirationPhotoId: request.inspirationPhotoId ?? null,
            status: "pending",
            outlookCalendarUser: calendarUser,
          })
          .returning();
      } catch (err) {
        if (isUniqueViolation(err, "booking_reference")) continue; // rare: try another reference
        if (isUniqueViolation(err, "request_id")) throw new BookingError("slot_unavailable", "This booking is already being saved. Please wait a moment.");
        if (isUniqueViolation(err)) throw new BookingError("slot_unavailable", friendly.slotTaken);
        log.error("booking.db", "Insert failed", { error: err as Error });
        throw new BookingError("server_error", friendly.server);
      }
    }
    if (!row) throw new BookingError("server_error", friendly.server);

    const details: BookingDetails = {
      reference: row.bookingReference,
      bundle,
      date,
      start,
      end,
      contact: request.contact,
      address: request.address,
      inspirationTitle: request.inspirationPhotoId ? await this.photoTitle(request.inspirationPhotoId) : undefined,
    };

    // 4. Create the Outlook event. If this fails, remove the pending row so nothing looks confirmed.
    let eventId: string;
    try {
      ({ id: eventId } = await createCalendarEvent({
        subject: eventSubject(details),
        bodyHtml: eventBodyHtml(details),
        start: graphLocalDateTime(date, start),
        end: graphLocalDateTime(date, end),
        timeZone: bookingRules.graphTimeZone,
        location: formatAddress(request.address),
        transactionId: row.id,
      }));
    } catch (err) {
      await db.delete(bookings).where(eq(bookings.id, row.id)).catch((e) => log.error("booking.db", "Rollback delete failed", { error: e }));
      asCalendarError(err, "createBooking.event");
    }

    // 5. Confirm in Neon with the event id. If that fails, remove the event again.
    try {
      await db.update(bookings).set({ status: "confirmed", outlookEventId: eventId, updatedAt: new Date() }).where(eq(bookings.id, row.id));
    } catch (err) {
      log.error("booking.db", "Confirm update failed; rolling back event", { error: err as Error, reference: row.bookingReference });
      await deleteCalendarEvent(eventId).catch((e) => log.error("booking.outlook", "Rollback event delete failed", { error: e }));
      await db.delete(bookings).where(eq(bookings.id, row.id)).catch(() => undefined);
      throw new BookingError("server_error", friendly.server);
    }

    // 6 + 7. Emails via Resend: the customer confirmation and the internal "new booking"
    // notification. Neither can undo the booking: failures are logged and recorded in Neon.
    const reason = (err: unknown) => (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    const [customer, internal] = await Promise.allSettled([
      (async () => {
        const mail = confirmationEmail(details);
        return sendEmail({
          scope: "resend.customer",
          to: request.contact.email,
          subject: mail.subject,
          html: mail.html,
          replyTo: emailConfig().notify,
          idempotencyKey: `booking-confirmation/${row.bookingReference}`,
          reference: row.bookingReference,
        });
      })(),
      (async () => {
        const mail = internalNotificationEmail(details, row.createdAt);
        return sendEmail({
          scope: "resend.internal",
          to: emailConfig().notify,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          replyTo: request.contact.email,
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

    log.info("booking.outlook", "Booking confirmed", { reference: row.bookingReference, customerEmailSent: emailSent, internalNotificationSent: internal.status === "fulfilled" });
    return { id: row.bookingReference, status: "confirmed", request, createdAt: row.createdAt.toISOString(), emailSent };
  }

  async cancelBooking(reference: string): Promise<void> {
    this.ensureConfigured();
    const db = getDb();
    const [row] = await db.select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    if (!row) throw new BookingError("not_found", "We couldn't find that booking.");
    if (row.status === "cancelled") return;
    try {
      if (row.outlookEventId) await deleteCalendarEvent(row.outlookEventId);
    } catch (err) {
      asCalendarError(err, "cancelBooking");
    }
    await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, row.id));
    log.info("booking.outlook", "Booking cancelled", { reference });
  }

  async rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult> {
    this.ensureConfigured();
    const db = getDb();
    const [row] = await db.select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    if (!row || row.status === "cancelled") throw new BookingError("not_found", "We couldn't find that booking.");
    const bundle = getBundle(row.packageId);
    if (!bundle) throw new BookingError("server_error", friendly.server);
    const tz = bookingRules.timeZone;
    const end = addMinutes(slot.start, bundle.durationMinutes);
    try {
      // ignore this booking's own time when checking the new slot
      const [rules, allBusy] = await Promise.all([getAvailabilityRules(), this.busyBetween(slot.date, slot.date)]);
      const busy = allBusy.filter((b) => !(b.start.getTime() === row.sessionStart.getTime() && b.end.getTime() === row.sessionEnd.getTime()));
      if (!slotsForDay(slot.date, bundle.durationMinutes, busy, rules).some((s) => s.start === slot.start)) {
        throw new BookingError("slot_unavailable", friendly.slotTaken);
      }
      if (row.outlookEventId) {
        await moveCalendarEvent(row.outlookEventId, graphLocalDateTime(slot.date, slot.start), graphLocalDateTime(slot.date, end), bookingRules.graphTimeZone);
      }
    } catch (err) {
      asCalendarError(err, "rescheduleBooking");
    }
    const [updated] = await db
      .update(bookings)
      .set({ sessionDate: slot.date, sessionStart: zonedTimeToUtc(slot.date, slot.start, tz), sessionEnd: zonedTimeToUtc(slot.date, end, tz), status: "rescheduled", updatedAt: new Date() })
      .where(eq(bookings.id, row.id))
      .returning();
    log.info("booking.outlook", "Booking rescheduled", { reference });
    return this.toResult(updated);
  }

  /** Title of a portfolio photo from any of the owner's picture sets (or the built-in ones). */
  private async photoTitle(id: string): Promise<string | undefined> {
    try {
      const settings = await getSiteSettings();
      const all = [...Object.values(settings.photoSets).flat(), ...portfolio];
      return all.find((p) => p?.id === id)?.title;
    } catch {
      return portfolio.find((p) => p.id === id)?.title;
    }
  }

  private toResult(row: Booking, request?: BookingRequest): BookingResult {
    const startLocal = new Intl.DateTimeFormat("en-GB", { timeZone: row.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(row.sessionStart);
    const endLocal = new Intl.DateTimeFormat("en-GB", { timeZone: row.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(row.sessionEnd);
    return {
      id: row.bookingReference,
      status: "confirmed",
      createdAt: row.createdAt.toISOString(),
      emailSent: row.confirmationEmailSent,
      request: request ?? {
        bundleId: row.packageId,
        address: { street: row.locationAddress, city: "", zip: "" },
        slot: { id: `${row.sessionDate}T${startLocal}`, date: row.sessionDate, start: startLocal, end: endLocal, label: startLocal },
        contact: { parentName: row.parentName, email: row.email, phone: row.phone, babyName: row.babyName ?? undefined, babyAge: row.babyAge, notes: row.notes ?? undefined },
      },
    };
  }
}
