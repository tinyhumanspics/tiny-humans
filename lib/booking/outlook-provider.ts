import "server-only";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { computeQuote, type PriceQuote } from "@/lib/pricing/engine";
import { attachUsage, claimCode, getCatalog, validateCode } from "@/lib/pricing/server";
import { portfolio } from "@/config/portfolio";
import { getSiteSettings } from "@/lib/settings/server";
import { allMediaPhotos } from "@/lib/settings/defaults";
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
import { addMinutes, formatTimeLabel } from "./dates";
import { generateBookingReference } from "./reference";
import { eventBodyHtml, eventSubject, formatAddress, type BookingDetails } from "./templates";
import { bookingConfirmationEmail, internalNewBookingEmail } from "@/lib/email";
import { createCancelToken } from "./cancel-token";
import { cancelBookingRow, findByCancelToken, summaryOf } from "./cancellation";
import { manageUrls, managedOf, rescheduleAvailability, rescheduleBookingRow } from "./reschedule";
import { site } from "@/config/site";
import { addDaysKey, graphLocalDateTime, todayInZone, zonedTimeToUtc } from "./timezone";
import type { AvailabilityQuery, BookingProvider, BookingRequest, BookingResult, CancelOptions, CancellationSummary, DayAvailability, ManagedBooking, TimeSlot } from "./types";

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
    const bundle = (await getCatalog()).find((b) => b.id === query.bundleId && b.active !== false);
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
    // Price + bundle always come from the central catalog on the server (never from the browser).
    const bundle = (await getCatalog()).find((b) => b.id === request.bundleId && b.active !== false);
    if (!bundle) throw new BookingError("invalid_request", "That bundle isn't available anymore. Please choose another one.");
    const tz = bookingRules.timeZone;
    const { calendarUser } = microsoftConfig();
    const date = request.slot.date;
    const start = request.slot.start;
    const end = addMinutes(start, bundle.durationMinutes);

    // 1. Same submission retried (double-click, flaky network): return the original booking.
    if (request.requestId) {
      const [existing] = await db.select().from(bookings).where(eq(bookings.requestId, request.requestId)).limit(1);
      if (existing && existing.status !== "cancelled" && existing.outlookEventId) return this.toResult(existing, request);
      // The first attempt is still being saved (e.g. a retry after a slow network): tell the browser to wait and
      // retry with the same requestId, never to pick another time (that could create a second booking).
      if (existing && existing.status === "pending") throw new BookingError("in_progress", friendly.inProgress);
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

    // 2b. Price, recalculated now. A code is re-validated and, if it's the price used, one use is reserved atomically.
    const { quote: pricing, codeId } = await this.priceFor(bundle.id, request.discountCode, request.contact.email);
    let usage: { usageId: string; release: () => Promise<void> } | null = null;
    if (pricing.pricingType === "discount" && codeId) usage = await claimCode(codeId, request.contact.email);
    const releaseUsage = () => usage?.release().catch(() => undefined);

    // 3. Save as pending (unique index on start time blocks a simultaneous double booking).
    const sessionStart = zonedTimeToUtc(date, start, tz);
    const sessionEnd = zonedTimeToUtc(date, end, tz);
    const cancel = createCancelToken();
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
            packagePrice: Math.round(pricing.finalCents / 100),
            regularPriceCents: pricing.regularCents,
            offerPriceCents: pricing.offerCents,
            offerLabel: pricing.offerLabel,
            discountCode: pricing.discountCode,
            discountAmountCents: pricing.discountCents,
            finalPriceCents: pricing.finalCents,
            pricingType: pricing.pricingType,
            packageInclusions: bundle.features,
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
            cancelTokenHash: cancel.hash,
          })
          .returning();
      } catch (err) {
        if (isUniqueViolation(err, "booking_reference")) continue; // rare: try another reference
        await releaseUsage();
        if (isUniqueViolation(err, "request_id")) throw new BookingError("in_progress", friendly.inProgress);
        if (isUniqueViolation(err)) throw new BookingError("slot_unavailable", friendly.slotTaken);
        log.error("booking.db", "Insert failed", { error: err as Error });
        throw new BookingError("server_error", friendly.server);
      }
    }
    if (!row) {
      await releaseUsage();
      throw new BookingError("server_error", friendly.server);
    }
    if (usage) await attachUsage(usage.usageId, row.id);

    const details: BookingDetails = {
      pricing,
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
      await releaseUsage();
      asCalendarError(err, "createBooking.event");
    }

    // 5. Confirm in Neon with the event id. If that fails, remove the event again.
    try {
      await db.update(bookings).set({ status: "confirmed", outlookEventId: eventId, updatedAt: new Date() }).where(eq(bookings.id, row.id));
    } catch (err) {
      log.error("booking.db", "Confirm update failed; rolling back event", { error: err as Error, reference: row.bookingReference });
      await deleteCalendarEvent(eventId).catch((e) => log.error("booking.outlook", "Rollback event delete failed", { error: e }));
      await db.delete(bookings).where(eq(bookings.id, row.id)).catch(() => undefined);
      await releaseUsage();
      throw new BookingError("server_error", friendly.server);
    }

    // 6 + 7. Emails via Resend: the customer confirmation and the internal "new booking"
    // notification. Neither can undo the booking: failures are logged and recorded in Neon.
    // Emails follow the website theme active right now (e.g. Christmas).
    const themeId = await getSiteSettings().then((x) => x.themeId).catch(() => "default");
    const reason = (err: unknown) => (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    const [customer, internal] = await Promise.allSettled([
      (async () => {
        const links = manageUrls(cancel.token);
        const mail = bookingConfirmationEmail(details, { themeId, cancelUrl: links.cancel, rescheduleUrl: links.reschedule, rescheduleNoticeHours: rules.limits.rescheduleNoticeHours });
        return sendEmail({
          scope: "resend.customer",
          to: request.contact.email,
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
        const mail = internalNewBookingEmail(details, row.createdAt);
        return sendEmail({
          scope: "resend.internal",
          from: emailConfig().internalFrom,
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
    return { id: row.bookingReference, status: "confirmed", request: { ...request, slot: { ...request.slot, end, label: formatTimeLabel(start) } }, createdAt: row.createdAt.toISOString(), emailSent, pricing, rescheduleNoticeHours: rules.limits.rescheduleNoticeHours };
  }

  /** Server-side price for a bundle (+ optional code, re-validated here). Never trusts the browser. */
  private async priceFor(bundleId: string, code: string | undefined, email: string | undefined): Promise<{ quote: PriceQuote; codeId: string | null }> {
    const bundle = (await getCatalog()).find((b) => b.id === bundleId && b.active !== false);
    if (!bundle) throw new BookingError("invalid_request", "That bundle isn't available anymore. Please choose another one.");
    const today = todayInZone(bookingRules.timeZone);
    if (!code?.trim()) return { quote: computeQuote(bundle, today), codeId: null };
    const check = await validateCode(code, bundleId, email);
    if (!check.ok) throw new BookingError("invalid_request", check.message);
    return { quote: computeQuote(bundle, today, check.terms), codeId: check.codeId };
  }

  async quote(bundleId: string, code?: string, email?: string): Promise<PriceQuote> {
    return (await this.priceFor(bundleId, code, email)).quote;
  }

  async cancelBooking(reference: string, opts?: CancelOptions): Promise<void> {
    this.ensureConfigured();
    const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    if (!row) throw new BookingError("not_found", "We couldn't find that booking.");
    await cancelBookingRow(row, opts ?? { reason: "Cancelled by Tiny Humans", by: "admin" });
  }

  async getCancellation(token: string): Promise<CancellationSummary> {
    this.ensureConfigured();
    const row = await findByCancelToken(token);
    if (!row) throw new BookingError("not_found", "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.");
    return summaryOf(row);
  }

  private async rowForToken(token: string) {
    this.ensureConfigured();
    const row = await findByCancelToken(token);
    if (!row) throw new BookingError("not_found", "This link isn't valid anymore. Please use the link in your most recent Tiny Humans email, or reply to it and we'll help.");
    return row;
  }

  async getManagedBooking(token: string): Promise<ManagedBooking> {
    const row = await this.rowForToken(token);
    return managedOf(row, await getAvailabilityRules());
  }

  async getRescheduleAvailability(token: string, from: string, to: string): Promise<DayAvailability[]> {
    const row = await this.rowForToken(token);
    if (!managedOf(row, await getAvailabilityRules()).canReschedule) return [];
    return rescheduleAvailability(row, from, to);
  }

  async rescheduleWithToken(token: string, slot: { date: string; start: string }): Promise<ManagedBooking> {
    const row = await this.rowForToken(token);
    const updated = await rescheduleBookingRow(row, slot, "customer");
    return managedOf(updated, await getAvailabilityRules());
  }

  async cancelWithToken(token: string, reason: string): Promise<CancellationSummary> {
    this.ensureConfigured();
    const row = await findByCancelToken(token);
    if (!row) throw new BookingError("not_found", "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.");
    const s = summaryOf(row);
    if (s.status === "past") throw new BookingError("invalid_request", "This session has already started, so it can't be cancelled online. Please reply to your confirmation email.");
    if (s.status === "cancelled") return s;
    return summaryOf(await cancelBookingRow(row, { reason, by: "customer" }));
  }

  async rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult> {
    this.ensureConfigured();
    const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    if (!row) throw new BookingError("not_found", "We couldn't find that booking.");
    return this.toResult(await rescheduleBookingRow(row, slot, "admin"));
  }

  /** Title of a portfolio photo from any of the owner's picture sets (or the built-in ones). */
  private async photoTitle(id: string): Promise<string | undefined> {
    try {
      const settings = await getSiteSettings();
      const all = [...allMediaPhotos(settings), ...portfolio];
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
      pricing: snapshotOf(row),
      request: request ?? {
        bundleId: row.packageId,
        address: { street: row.locationAddress, city: "", zip: "" },
        slot: { id: `${row.sessionDate}T${startLocal}`, date: row.sessionDate, start: startLocal, end: endLocal, label: startLocal },
        contact: { parentName: row.parentName, email: row.email, phone: row.phone, babyName: row.babyName ?? undefined, babyAge: row.babyAge, notes: row.notes ?? undefined },
      },
    };
  }
}

/** Price snapshot stored on a booking (older bookings fall back to package_price). */
export function snapshotOf(row: Booking): PriceQuote {
  const legacy = row.packagePrice * 100;
  return {
    bundleId: row.packageId,
    bundleName: row.packageName,
    regularCents: row.regularPriceCents ?? legacy,
    offerCents: row.offerPriceCents,
    offerLabel: row.offerLabel,
    offerEndsOn: null,
    discountCode: row.discountCode,
    discountCents: row.discountAmountCents ?? 0,
    finalCents: row.finalPriceCents ?? legacy,
    pricingType: (row.pricingType as PriceQuote["pricingType"]) ?? "regular",
  };
}
