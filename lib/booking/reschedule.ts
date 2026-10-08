import "server-only";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { site } from "@/config/site";
import { getDb, isOverlapViolation, isUniqueViolation } from "@/lib/db/client";
import { bookingRescheduleHistory, bookings, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { GraphAuthError } from "@/lib/microsoft/auth";
import { GraphError } from "@/lib/microsoft/graph";
import { getBusyIntervals, moveCalendarEvent } from "@/lib/microsoft/calendar";
import { isMicrosoftConfigured } from "@/lib/microsoft/config";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { bookingRescheduledEmail, internalRescheduleEmail } from "@/lib/email";
import { getAvailabilityRules } from "@/lib/availability/server";
import { getSiteSettings } from "@/lib/settings/server";
import { depositInfoOf, depositOf } from "@/lib/deposit/server";
import type { AvailabilityRules } from "@/lib/availability/types";
import { availabilityForRange, slotsForDay, type Busy } from "./availability";
import { addMinutes } from "./dates";
import { BookingError, friendly } from "./errors";
import { createCancelToken } from "./cancel-token";
import { rescheduleClosedText } from "./reschedule-policy";
import { noticeHoursFor } from "./terms";
import { addDaysKey, graphLocalDateTime, zonedTimeToUtc } from "./timezone";
import type { DayAvailability, ManagedBooking } from "./types";

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const localDate = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Customer links: management URLs built from our own site address. */
export function manageUrls(token: string) {
  const base = site.url.replace(/\/$/, "");
  return { reschedule: `${base}/reschedule?t=${token}`, cancel: `${base}/cancel?t=${token}`, backdrop: `${base}/backdrop?t=${token}` };
}

/** `noticeHours`: the booking's own notice (booking_terms); defaults to today's setting. */
export function managedOf(row: Booking, rules: AvailabilityRules, now = new Date(), noticeHours = rules.limits.rescheduleNoticeHours, rescheduleNoticeOverride = false): ManagedBooking {
  const past = row.sessionStart.getTime() <= now.getTime();
  const status = row.status === "cancelled" ? "cancelled" : past ? "past" : "active";
  const hoursLeft = (row.sessionStart.getTime() - now.getTime()) / 3_600_000;
  return {
    reference: row.bookingReference,
    bundleId: row.packageId,
    bundleName: row.packageName,
    date: row.sessionDate,
    start: localTime(row.sessionStart, row.timezone),
    end: localTime(row.sessionEnd, row.timezone),
    location: row.locationAddress,
    parentFirstName: row.parentName.split(" ")[0],
    status,
    canReschedule: status === "active" && (rescheduleNoticeOverride || hoursLeft >= noticeHours),
    rescheduleNoticeHours: noticeHours,
  };
}

/**
 * Busy time for rescheduling ONE booking: Outlook events + active Neon bookings,
 * minus only that booking's own row and its own Outlook event. The booking is
 * identified server-side (token or admin), never by an id the browser sends.
 */
async function busyExcluding(own: Booking, fromDate: string, toDate: string): Promise<Busy[]> {
  const tz = bookingRules.timeZone;
  const from = zonedTimeToUtc(addDaysKey(fromDate, -1), "00:00", tz);
  const to = zonedTimeToUtc(addDaysKey(toDate, 2), "00:00", tz);
  const [calendar, rows] = await Promise.all([
    isMicrosoftConfigured() ? getBusyIntervals(from, to) : Promise.resolve([]),
    getDb()
      .select({ start: bookings.sessionStart, end: bookings.sessionEnd })
      .from(bookings)
      .where(and(ne(bookings.status, "cancelled"), ne(bookings.id, own.id), gte(bookings.sessionDate, addDaysKey(fromDate, -1)), lte(bookings.sessionDate, addDaysKey(toDate, 1)))),
  ]);
  return [...calendar.filter((e) => !own.outlookEventId || e.eventId !== own.outlookEventId).map((e) => ({ start: e.start, end: e.end })), ...rows];
}

export async function rescheduleAvailability(own: Booking, from: string, to: string): Promise<DayAvailability[]> {
  // the booking keeps its own session length (even if the bundle changes later)
  const minutes = Math.round((own.sessionEnd.getTime() - own.sessionStart.getTime()) / 60_000);
  try {
    const [rules, busy] = await Promise.all([getAvailabilityRules(), busyExcluding(own, from, to)]);
    return availabilityForRange(from, to, minutes, busy, rules);
  } catch (err) {
    log.error("booking.reschedule", "Availability failed", { error: err as Error, reference: own.bookingReference });
    if (err instanceof GraphError || err instanceof GraphAuthError) throw new BookingError("calendar_unavailable", friendly.calendar);
    throw new BookingError("server_error", "We couldn't load open times. Please try again.");
  }
}

/**
 * Move a booking to a new date/time (same row, same reference). Order:
 * 1. checks: active, (customer) reschedule notice, slot free right now (own booking ignored)
 * 2. Outlook: PATCH the existing event (one event per booking). If it fails, nothing changes.
 * 3. Neon: update the booking + append history atomically. If that fails, the Outlook
 *    event is moved back so both systems keep the old time.
 * 4. Emails (customer + internal); failures are logged, never undo the change.
 * The management token rotates; the customer email carries the new links.
 */
export async function rescheduleBookingRow(row: Booking, slot: { date: string; start: string }, by: "customer" | "admin", rescheduleNoticeOverride = false): Promise<Booking> {
  if (row.status === "cancelled") throw new BookingError("invalid_request", "This booking has already been cancelled.");
  const rules = await getAvailabilityRules().catch(() => {
    throw new BookingError("server_error", friendly.server);
  });
  const current = managedOf(row, rules, new Date(), await noticeHoursFor(row, rules.limits.rescheduleNoticeHours));
  if (current.status === "past") throw new BookingError("invalid_request", "This session has already started, so it can't be moved online.");
  if (by === "customer" && !rescheduleNoticeOverride && !current.canReschedule) {
    throw new BookingError("reschedule_closed", rescheduleClosedText(current.rescheduleNoticeHours));
  }
  const tz = row.timezone || bookingRules.timeZone;
  const minutes = Math.round((row.sessionEnd.getTime() - row.sessionStart.getTime()) / 60_000);
  const end = addMinutes(slot.start, minutes);
  const newStart = zonedTimeToUtc(slot.date, slot.start, tz);
  const newEnd = zonedTimeToUtc(slot.date, end, tz);
  if (newStart.getTime() === row.sessionStart.getTime()) throw new BookingError("invalid_request", "That's your current time. Please choose a different one.");

  let busy: Busy[];
  try {
    busy = await busyExcluding(row, slot.date, slot.date);
  } catch (err) {
    log.error("booking.reschedule", "Recheck failed", { error: err as Error, reference: row.bookingReference });
    throw new BookingError("calendar_unavailable", friendly.calendar);
  }
  if (!slotsForDay(slot.date, minutes, busy, rules).some((s) => s.start === slot.start)) throw new BookingError("slot_unavailable", friendly.rescheduleTaken);

  const graphTz = bookingRules.graphTimeZone;
  const oldDate = row.sessionDate;
  const oldStartL = localTime(row.sessionStart, tz);
  const oldEndL = localTime(row.sessionEnd, tz);
  const canPatch = Boolean(row.outlookEventId) && isMicrosoftConfigured();
  if (canPatch) {
    try {
      await moveCalendarEvent(row.outlookEventId!, graphLocalDateTime(slot.date, slot.start), graphLocalDateTime(slot.date, end), graphTz);
    } catch (err) {
      log.error("booking.reschedule", "Outlook update failed; booking unchanged", { error: err as Error, reference: row.bookingReference });
      throw new BookingError("calendar_unavailable", "We couldn't update the calendar just now. Your current booking hasn't changed. Please try again in a minute.");
    }
  }

  const db = getDb();
  const token = createCancelToken();
  const now = new Date();
  let updated: Booking;
  try {
    const [u] = await db.batch([
      db
        .update(bookings)
        .set({ sessionDate: slot.date, sessionStart: newStart, sessionEnd: newEnd, status: "rescheduled", cancelTokenHash: token.hash, updatedAt: now })
        .where(and(eq(bookings.id, row.id), ne(bookings.status, "cancelled")))
        .returning(),
      db.insert(bookingRescheduleHistory).values({ bookingId: row.id, oldSessionStart: row.sessionStart, oldSessionEnd: row.sessionEnd, newSessionStart: newStart, newSessionEnd: newEnd, rescheduledBy: by }),
    ]);
    if (!u[0]) throw new Error("booking changed");
    updated = u[0];
  } catch (err) {
    log.error("booking.reschedule", "Saving the new time failed; moving the Outlook event back", { error: err as Error, reference: row.bookingReference });
    if (canPatch) await moveCalendarEvent(row.outlookEventId!, graphLocalDateTime(oldDate, oldStartL), graphLocalDateTime(oldDate, oldEndL), graphTz).catch((e) => log.error("booking.reschedule", "Could not move the Outlook event back", { error: e as Error, reference: row.bookingReference }));
    const unique = isUniqueViolation(err) || isOverlapViolation(err) || JSON.stringify(err ?? "").includes("23505") || String((err as Error)?.message).includes("duplicate");
    throw new BookingError(unique ? "slot_unavailable" : "server_error", unique ? friendly.rescheduleTaken : "We couldn't save the new time. Your current booking hasn't changed. Please try again.");
  }
  log.info("booking.reschedule", "Booking rescheduled", { reference: row.bookingReference, by });

  const details = {
    reference: updated.bookingReference,
    parentName: updated.parentName,
    email: updated.email,
    phone: updated.phone,
    bundleName: updated.packageName,
    packageTotalCents: updated.finalPriceCents ?? updated.packagePrice * 100,
    location: updated.locationAddress,
    oldDate,
    oldStart: oldStartL,
    oldEnd: oldEndL,
    newDate: slot.date,
    newStart: slot.start,
    newEnd: end,
    rescheduledBy: by,
    rescheduledAt: now,
    status: "Rescheduled",
    totalCents: (updated.finalPriceCents ?? updated.packagePrice * 100) + (updated.addonsTotalCents ?? 0) + (updated.travelFeeCents ?? 0),
    deposit: depositInfoOf(await depositOf(updated.id)),
  };
  const themeId = await getSiteSettings().then((x) => x.themeId).catch(() => "default");
  const cfg = emailConfig();
  const n = (await db.select({ id: bookingRescheduleHistory.id }).from(bookingRescheduleHistory).where(eq(bookingRescheduleHistory.bookingId, row.id)).catch(() => [])).length;
  await Promise.allSettled([
    (async () => {
      const m = await bookingRescheduledEmail(details, { themeId, manage: manageUrls(token.token), locale: updated.locale });
      return sendEmail({ scope: "resend.reschedule", to: updated.email, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments, replyTo: cfg.notify, idempotencyKey: `booking-reschedule/${updated.bookingReference}/${n}`, reference: updated.bookingReference });
    })(),
    (async () => {
      const m = await internalRescheduleEmail(details);
      return sendEmail({ scope: "resend.internal-reschedule", from: cfg.internalFrom, to: cfg.notify, subject: m.subject, html: m.html, text: m.text, replyTo: updated.email, idempotencyKey: `booking-internal-reschedule/${updated.bookingReference}/${n}`, reference: updated.bookingReference });
    })(),
  ]).then((rs) => rs.forEach((r) => r.status === "rejected" && log.warn("booking.reschedule", "Email not sent (booking still rescheduled)", { code: r.reason instanceof EmailSendError ? r.reason.code : "send_failed", reference: updated.bookingReference })));
  return updated;
}

/** History rows for leads (oldest first). */
export async function historyFor(bookingIds: string[]) {
  if (!bookingIds.length) return [];
  return getDb().select().from(bookingRescheduleHistory).where(inArray(bookingRescheduleHistory.bookingId, bookingIds)).orderBy(asc(bookingRescheduleHistory.createdAt));
}

export { localDate, localTime };
