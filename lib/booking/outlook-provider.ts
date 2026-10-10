import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { computeQuote, type PriceQuote } from "@/lib/pricing/engine";
import { attachUsage, claimCode, getCatalog, validateCode } from "@/lib/pricing/server";
import { getDb, isDatabaseConfigured, isOverlapViolation, isUniqueViolation } from "@/lib/db/client";
import { bookingConsents, bookings, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { getBusyIntervals } from "@/lib/microsoft/calendar";
import { isMicrosoftConfigured, microsoftConfig } from "@/lib/microsoft/config";
import { availabilityForRange, slotsForDay, type Busy } from "./availability";
import { getAvailabilityRules } from "@/lib/availability/server";
import { BookingError, friendly } from "./errors";
import { addMinutes, formatTimeLabel } from "./dates";
import { generateBookingReference } from "./reference";
import { formatAddress, type BookingDetails } from "./templates";
import { createCancelToken, manageTokenFor } from "./cancel-token";
import { cancelBookingRow, findByCancelToken, findManageToken, summaryOf } from "./cancellation";
import { cancelClosedText } from "./reschedule-policy";
import { noticeHoursFor, saveBookingTerms } from "./terms";
import { saveAccessNotes } from "./access";
import { saveBookingBackdrops } from "./backdrops";
import { asCalendarError, confirmBookingRow } from "./confirm";
import { photoTitle, snapshotOf } from "./details";
import { setupsOf } from "@/config/backdrops";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import { bookingTravelOf } from "@/lib/travel/types";
import { fill } from "@/lib/email/messages";
import { managedOf, rescheduleAvailability, rescheduleBookingRow } from "./reschedule";
import { site } from "@/config/site";
import { getDepositSettings } from "@/lib/deposit/server";
import { depositCentsFor } from "@/lib/deposit/types";
import { openDeposit, reopenDeposit, sweepDeposits } from "@/lib/deposit/flow";
import { addDaysKey, todayInZone, zonedTimeToUtc } from "./timezone";
import { addPhotos, extraBabyLine, sessionMinutes, withExtraBabies, type BookingBaby } from "./extra-babies";
import { saveBookingAddons } from "./addons";
import type { AvailabilityQuery, BookingProvider, BookingRequest, BookingResult, CancelOptions, CancellationSummary, DayAvailability, ManagedBooking, TimeSlot } from "./types";

const ACTIVE = ne(bookings.status, "cancelled");

/** Booking source columns (first touch of the visit). */
function sourceColumns(a: BookingRequest["attribution"]) {
  return {
    utmSource: a?.utmSource ?? null,
    utmMedium: a?.utmMedium ?? null,
    utmCampaign: a?.utmCampaign ?? null,
    utmContent: a?.utmContent ?? null,
    utmTerm: a?.utmTerm ?? null,
    fbclid: a?.fbclid ?? null,
    landingPath: a?.landingPath ?? null,
    referrer: a?.referrer ?? null,
    firstTouchAt: a?.at ? new Date(a.at) : null,
  };
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
    const count = query.babyCount ?? 1;
    if (count > 1 && !extraBabyLine(bundle, count)) throw new BookingError("invalid_request", "That bundle doesn't offer this baby count.");
    const minutes = sessionMinutes(bundle, count);
    // deposit pages that ran out free their time (after this response, so it never slows the calendar down)
    try {
      after(() => sweepDeposits().then(() => undefined));
    } catch {
      /* outside a request (scripts) */
    }
    try {
      const [rules, busy] = await Promise.all([getAvailabilityRules(), this.busyBetween(query.from, query.to)]);
      return availabilityForRange(query.from, query.to, minutes, busy, rules);
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
    const babies: BookingBaby[] = request.babies?.length ? request.babies : [{ name: request.contact.babyName, age: request.contact.babyAge }];
    const addon = extraBabyLine(bundle, babies.length);
    if (babies.length > 1 && !addon) throw new BookingError("invalid_request", "That bundle doesn't offer this baby count anymore. Please choose again.");
    const durationMinutes = sessionMinutes(bundle, babies.length);
    const tz = bookingRules.timeZone;
    const { calendarUser } = microsoftConfig();
    const date = request.slot.date;
    const start = request.slot.start;
    const end = addMinutes(start, durationMinutes);

    // 1. Same submission retried (double-click, flaky network): return the original booking.
    if (request.requestId) {
      const [existing] = await db.select().from(bookings).where(eq(bookings.requestId, request.requestId)).limit(1);
      if (existing && existing.status !== "cancelled" && existing.outlookEventId) return this.toResult(existing, request);
      if (existing && existing.status === "pending") {
        // already waiting on its deposit page: the same page again
        const deposit = await reopenDeposit(existing);
        if (deposit) return { ...this.toResult(existing, request), status: "pending", deposit };
        // The first attempt is still being saved (e.g. a retry after a slow network): tell the browser to wait and
        // retry with the same requestId, never to pick another time (that could create a second booking).
        throw new BookingError("in_progress", friendly.inProgress);
      }
    }

    // 1b. Travel fee from the home's ZIP code (calculated here, never taken from the browser). Florida only, and not
    // farther than the owner's limit (those families text instead).
    const quote = travelQuote(request.address.zip, await getTravelSettings());
    const messages = request.locale === "es" ? es : en;
    if (quote.status === "outside_florida") throw new BookingError("invalid_request", messages.bookingFlow.details.travel.outsideFlorida);
    if (quote.status === "too_far") throw new BookingError("invalid_request", fill(messages.bookingFlow.details.travel.tooFar, { phone: site.contact.phone }));
    const travel = bookingTravelOf(quote);
    // optional backdrop picks: one per setup of the bundle
    const backdrops = request.backdrops?.slice(0, setupsOf([bundle.setups, ...bundle.features]));

    // 2. Re-check availability against the live calendar (first freeing times whose deposit page ran out).
    await sweepDeposits();
    let busy: Busy[];
    let rules: Awaited<ReturnType<typeof getAvailabilityRules>>;
    try {
      [rules, busy] = await Promise.all([getAvailabilityRules(), this.busyBetween(date, date)]);
    } catch (err) {
      asCalendarError(err, "createBooking.recheck");
    }
    if (!slotsForDay(date, durationMinutes, busy, rules).some((s) => s.start === start)) {
      throw new BookingError("slot_unavailable", friendly.slotTaken);
    }

    // 2b. Price, recalculated now. A code is re-validated and, if it's the price used, one use is reserved atomically.
    const { quote: pricing, codeId } = await this.priceFor(bundle.id, request.discountCode, request.contact.email, babies.length);
    let usage: { usageId: string; release: () => Promise<void> } | null = null;
    if (pricing.pricingType === "discount" && codeId) usage = await claimCode(codeId, request.contact.email);
    const releaseUsage = () => usage?.release().catch(() => undefined);

    // 2c. Deposit: the bundle's, paid on Stripe as the last step (confirmed once it's paid). Never more than the total.
    const depositCents = depositCentsFor(pricing.totalCents + (travel.feeCents ?? 0), bundle.id, await getDepositSettings());

    // 3. Save as pending (unique index on start time blocks a simultaneous double booking).
    const sessionStart = zonedTimeToUtc(date, start, tz);
    const sessionEnd = zonedTimeToUtc(date, end, tz);
    const id = randomUUID();
    // a booking confirmed later (after its deposit) gets a token any request can rebuild for its emails
    const cancel = (depositCents > 0 && manageTokenFor(id)) || createCancelToken();
    let row: Booking | undefined;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      try {
        [row] = await db
          .insert(bookings)
          .values({
            id,
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
            travelFeeCents: travel.feeCents,
            travelMiles: travel.miles,
            addonsTotalCents: pricing.addonsCents,
            parentName: request.contact.parentName,
            email: request.contact.email,
            phone: request.contact.phone,
            locale: request.locale ?? "en",
            babyName: babies[0].name ?? null,
            babyAge: babies[0].age,
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
            ...sourceColumns(request.attribution),
          })
          .returning();
      } catch (err) {
        if (isUniqueViolation(err, "booking_reference")) continue; // rare: try another reference
        await releaseUsage();
        if (isUniqueViolation(err, "request_id")) throw new BookingError("in_progress", friendly.inProgress);
        if (isUniqueViolation(err) || isOverlapViolation(err)) throw new BookingError("slot_unavailable", friendly.slotTaken);
        log.error("booking.db", "Insert failed", { error: err as Error });
        throw new BookingError("server_error", friendly.server);
      }
    }
    if (!row) {
      await releaseUsage();
      throw new BookingError("server_error", friendly.server);
    }
    if (usage) await attachUsage(usage.usageId, row.id);

    // What this booking was promised (online cancel/reschedule notice, photo count): later /admin changes don't touch
    // it. Saved now with the other extras (best effort), so a booking confirmed after its deposit has them too.
    const noticeHours = rules.limits.rescheduleNoticeHours;
    await saveBookingTerms(row.id, noticeHours, addPhotos(bundle.photos, addon?.extraPhotos ?? 0), row.bookingReference);
    await saveAccessNotes(row.id, request.address.accessNotes, row.bookingReference);
    await saveBookingBackdrops(row.id, backdrops, row.bookingReference);
    await saveBookingAddons(row.id, babies, addon, row.bookingReference);
    // Optional permissions (best effort; they're also in the event + studio email).
    if (request.consents) {
      const at = request.consents.sms || request.consents.photos ? new Date() : null;
      await db
        .insert(bookingConsents)
        .values({ bookingId: row.id, sms: request.consents.sms, smsAt: request.consents.sms ? at : null, photos: request.consents.photos, photosAt: request.consents.photos ? at : null })
        .onConflictDoNothing()
        .catch((err) => log.error("booking.db", "Permissions not saved", { reference: row.bookingReference, error: err as Error }));
    }
    const slot = { ...request.slot, end, label: formatTimeLabel(start) };

    // 4a. Deposit: send the family to Stripe. The booking stays pending (holding its time) until it's paid; then the
    // webhook or the page they come back to confirms it (lib/deposit/flow.ts). Stripe down → booked without it.
    let deposit: BookingDetails["deposit"];
    if (depositCents > 0) {
      const opened = await openDeposit(row, depositCents, noticeHours);
      if (opened) return { id: row.bookingReference, status: "pending", request: { ...request, slot }, createdAt: row.createdAt.toISOString(), pricing, travel, rescheduleNoticeHours: noticeHours, deposit: opened };
      deposit = { amountCents: depositCents, status: "unpaid" };
    }

    const details: BookingDetails = {
      pricing,
      reference: row.bookingReference,
      bundle,
      date,
      start,
      end,
      contact: request.contact,
      babies,
      address: request.address,
      inspirationTitle: request.inspirationPhotoId ? await photoTitle(request.inspirationPhotoId) : undefined,
      consents: request.consents,
      travel,
      backdrops,
      deposit,
    };

    // 4b–7. Outlook event → confirmed → emails. If the event can't be made, remove the pending row so nothing looks
    // confirmed (its extras go with it).
    let emailSent: boolean;
    try {
      ({ emailSent } = await confirmBookingRow(row, details, { manageToken: cancel.token, noticeHours }));
    } catch (err) {
      await db.delete(bookings).where(eq(bookings.id, row.id)).catch((e) => log.error("booking.db", "Rollback delete failed", { error: e }));
      await releaseUsage();
      throw err;
    }
    return { id: row.bookingReference, status: "confirmed", request: { ...request, slot }, createdAt: row.createdAt.toISOString(), emailSent, pricing, travel, rescheduleNoticeHours: noticeHours, deposit };
  }

  /** Server-side price for a bundle (+ optional code, re-validated here). Never trusts the browser. */
  private async priceFor(bundleId: string, code: string | undefined, email: string | undefined, babyCount = 1): Promise<{ quote: PriceQuote; codeId: string | null }> {
    const bundle = (await getCatalog()).find((b) => b.id === bundleId && b.active !== false);
    if (!bundle) throw new BookingError("invalid_request", "That bundle isn't available anymore. Please choose another one.");
    const today = todayInZone(bookingRules.timeZone);
    if (babyCount > 1 && !extraBabyLine(bundle, babyCount)) throw new BookingError("invalid_request", "That bundle doesn't offer this baby count.");
    if (!code?.trim()) return { quote: withExtraBabies(computeQuote(bundle, today), bundle, babyCount), codeId: null };
    const check = await validateCode(code, bundleId, email);
    if (!check.ok) throw new BookingError("invalid_request", check.message);
    return { quote: withExtraBabies(computeQuote(bundle, today, check.terms), bundle, babyCount), codeId: check.codeId };
  }

  async quote(bundleId: string, code?: string, email?: string, babyCount = 1): Promise<PriceQuote> {
    return (await this.priceFor(bundleId, code, email, babyCount)).quote;
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
    return summaryOf(row, (await this.notice(row)).hours);
  }

  private async rowForToken(token: string) {
    this.ensureConfigured();
    const found = await findManageToken(token);
    if (!found) throw new BookingError("not_found", "This link isn't valid anymore. Please use the link in your most recent Tiny Humans email, or reply to it and we'll help.");
    return found;
  }

  /** The booking's own online cancel/reschedule notice (booking_terms), else today's setting. */
  private async notice(row: Booking): Promise<{ rules: Awaited<ReturnType<typeof getAvailabilityRules>>; hours: number }> {
    const rules = await getAvailabilityRules();
    return { rules, hours: await noticeHoursFor(row, rules.limits.rescheduleNoticeHours) };
  }

  async getManagedBooking(token: string): Promise<ManagedBooking> {
    const { booking: row, rescheduleNoticeOverride } = await this.rowForToken(token);
    const { rules, hours } = await this.notice(row);
    return managedOf(row, rules, new Date(), hours, rescheduleNoticeOverride);
  }

  async getRescheduleAvailability(token: string, from: string, to: string): Promise<DayAvailability[]> {
    const { booking: row, rescheduleNoticeOverride } = await this.rowForToken(token);
    const { rules, hours } = await this.notice(row);
    if (!managedOf(row, rules, new Date(), hours, rescheduleNoticeOverride).canReschedule) return [];
    return rescheduleAvailability(row, from, to);
  }

  async rescheduleWithToken(token: string, slot: { date: string; start: string }): Promise<ManagedBooking> {
    const { booking: row, rescheduleNoticeOverride } = await this.rowForToken(token);
    const updated = await rescheduleBookingRow(row, slot, "customer", rescheduleNoticeOverride);
    const { rules, hours } = await this.notice(updated);
    return managedOf(updated, rules, new Date(), hours);
  }

  async cancelWithToken(token: string, reason: string): Promise<CancellationSummary> {
    this.ensureConfigured();
    const row = await findByCancelToken(token);
    if (!row) throw new BookingError("not_found", "This cancellation link isn't valid. Please reply to your confirmation email and we'll help.");
    const { hours } = await this.notice(row);
    const s = summaryOf(row, hours);
    if (s.status === "past") throw new BookingError("invalid_request", "This session has already started, so it can't be cancelled online. Please reply to your confirmation email.");
    if (s.status === "cancelled") return s;
    if (!s.canCancel) throw new BookingError("cancel_closed", cancelClosedText(hours));
    // online cancellation is only possible before the notice window: the deposit is refunded
    return summaryOf(await cancelBookingRow(row, { reason, by: "customer", refundDeposit: true }), hours);
  }

  async rescheduleBooking(reference: string, slot: Pick<TimeSlot, "date" | "start">): Promise<BookingResult> {
    this.ensureConfigured();
    const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    if (!row) throw new BookingError("not_found", "We couldn't find that booking.");
    return this.toResult(await rescheduleBookingRow(row, slot, "admin"));
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
      travel: { feeCents: row.travelFeeCents, miles: row.travelMiles },
      request: request ? { ...request, locale: row.locale } : {
        bundleId: row.packageId,
        locale: row.locale,
        address: { street: row.locationAddress, city: "", zip: "" },
        slot: { id: `${row.sessionDate}T${startLocal}`, date: row.sessionDate, start: startLocal, end: endLocal, label: startLocal },
        contact: { parentName: row.parentName, email: row.email, phone: row.phone, babyName: row.babyName ?? undefined, babyAge: row.babyAge, notes: row.notes ?? undefined },
      },
    };
  }
}
