import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingEmails, bookings, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { GraphAuthError } from "@/lib/microsoft/auth";
import { GraphError } from "@/lib/microsoft/graph";
import { deleteCalendarEvent } from "@/lib/microsoft/calendar";
import { isMicrosoftConfigured } from "@/lib/microsoft/config";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { bookingCancellationEmail, internalCancellationEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings/server";
import { settleDepositOnCancel } from "@/lib/deposit/refund";
import { BookingError, friendly } from "./errors";
import { hashCancelToken, looksLikeCancelToken } from "./cancel-token";
import type { CancellationDetails } from "./templates";
import type { CancelOptions, CancellationSummary } from "./types";

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** `noticeHours`: the booking's own online cancel/reschedule notice (see ./terms). */
export function summaryOf(row: Booking, noticeHours: number, now = new Date()): CancellationSummary {
  const status = row.status === "cancelled" ? "cancelled" : row.sessionStart.getTime() <= now.getTime() ? "past" : "active";
  return {
    reference: row.bookingReference,
    bundleName: row.packageName,
    date: row.sessionDate,
    start: localTime(row.sessionStart, row.timezone),
    end: localTime(row.sessionEnd, row.timezone),
    parentFirstName: row.parentName.split(" ")[0],
    status,
    canCancel: status === "active" && (row.sessionStart.getTime() - now.getTime()) / 3_600_000 >= noticeHours,
    noticeHours,
  };
}

export interface ManageTokenBooking {
  booking: Booking;
  /** A day-closure link lets the family move even inside the normal notice window. */
  rescheduleNoticeOverride: boolean;
}

/** Booking + purpose behind a management token. Email tokens expire automatically when the session time changes. */
export async function findManageToken(token: string): Promise<ManageTokenBooking | null> {
  if (!looksLikeCancelToken(token)) return null;
  const hash = hashCancelToken(token);
  const db = getDb();
  const [row] = await db.select().from(bookings).where(eq(bookings.cancelTokenHash, hash)).limit(1);
  if (row) return { booking: row, rescheduleNoticeOverride: false };
  const [viaEmail] = await db
    .select({ booking: bookings, kind: bookingEmails.kind })
    .from(bookingEmails)
    .innerJoin(bookings, and(eq(bookings.id, bookingEmails.bookingId), eq(bookings.sessionStart, bookingEmails.sessionStart)))
    .where(and(eq(bookingEmails.linkTokenHash, hash), inArray(bookingEmails.kind, ["reminder_72h", "reminder_24h", "day_closed"])))
    .limit(1)
    .catch(() => {
      // A Drizzle error message repeats query values, including the token hash. Keep it out of logs.
      log.error("booking.token", "Email manage-link lookup failed");
      return [];
    });
  return viaEmail ? { booking: viaEmail.booking, rescheduleNoticeOverride: viaEmail.kind === "day_closed" } : null;
}

/** The booking behind any valid cancel/manage token (used by cancellation and backdrop pages). */
export async function findByCancelToken(token: string): Promise<Booking | null> {
  const found = await findManageToken(token);
  return found && !found.rescheduleNoticeOverride ? found.booking : null;
}

/** Theme the website is using right now (emails follow it). */
async function activeThemeId(): Promise<string> {
  try {
    return (await getSiteSettings()).themeId;
  } catch {
    return "default";
  }
}

/**
 * Cancel a booking (customer link or admin), keeping Neon and Outlook consistent:
 * 1. Neon: one conditional update (only if not already cancelled) saves status,
 *    reason, cancelled_at and cancelled_by. Only one request can win, so a booking
 *    can't be cancelled twice (customer/admin races included). If this fails,
 *    Outlook is never touched.
 * 2. Outlook: delete the event. Until this succeeds the event still blocks the
 *    slot, so the time is only freed once both systems agree.
 * 3. If Outlook fails, the Neon change is rolled back to the exact previous state
 *    (guarded so it only undoes this cancellation) and the caller gets a friendly
 *    error. If even the rollback fails, it is logged loudly for manual recovery;
 *    the Outlook event still exists, so the slot can't be double-booked.
 * 4. The paid deposit is refunded (opts.refundDeposit) or kept; a failed refund is flagged, never undoes anything.
 * 5. Emails (customer + internal). Failures are recorded, never undo the cancellation.
 * The booking row is never deleted; reschedule history is untouched.
 */
export async function cancelBookingRow(row: Booking, opts: CancelOptions): Promise<Booking> {
  if (row.status === "cancelled") return row;
  const db = getDb();
  const reason = opts.reason.trim().slice(0, 1000);
  const busy = "We couldn't cancel just now. Please try again in a minute.";

  // 1. Neon: claim the cancellation atomically.
  const cancelledAt = new Date();
  let claimed: Booking | undefined;
  try {
    [claimed] = await db
      .update(bookings)
      .set({ status: "cancelled", cancellationReason: reason, cancelledAt, cancelledBy: opts.by, updatedAt: cancelledAt })
      .where(and(eq(bookings.id, row.id), ne(bookings.status, "cancelled")))
      .returning();
  } catch (err) {
    log.error("booking.cancel", "Could not save the cancellation in Neon; Outlook left untouched", { error: err as Error, reference: row.bookingReference });
    throw new BookingError("server_error", busy);
  }
  if (!claimed) {
    // Someone else already cancelled it (double click, customer + admin race): nothing more to do.
    const [current] = await db.select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
    log.info("booking.cancel", "Already cancelled; no action taken", { reference: row.bookingReference });
    return current ?? row;
  }

  // 2. Outlook: remove the event (an event that is already gone counts as removed).
  const eventId = claimed.outlookEventId;
  if (eventId && isMicrosoftConfigured()) {
    try {
      await deleteCalendarEvent(eventId);
    } catch (err) {
      // 3. Roll Neon back to exactly what it was, only if it's still our cancellation.
      log.error("booking.cancel", "Outlook event could not be removed; rolling back the Neon cancellation", { error: err as Error, reference: row.bookingReference });
      try {
        const [restored] = await db
          .update(bookings)
          .set({ status: row.status, cancellationReason: row.cancellationReason, cancelledAt: row.cancelledAt, cancelledBy: row.cancelledBy, updatedAt: new Date() })
          .where(and(eq(bookings.id, row.id), eq(bookings.status, "cancelled"), eq(bookings.cancelledAt, cancelledAt)))
          .returning({ id: bookings.id });
        if (!restored) throw new Error("rollback matched no row");
        log.warn("booking.cancel", "Cancellation rolled back; booking is active again with its Outlook event", { reference: row.bookingReference });
      } catch (rollbackErr) {
        log.error("booking.cancel", "MANUAL RECOVERY NEEDED: Neon says cancelled but the Outlook event still exists (slot stays blocked)", {
          error: rollbackErr as Error,
          reference: row.bookingReference,
          outlookEventPresent: true,
        });
      }
      if (err instanceof GraphError || err instanceof GraphAuthError) throw new BookingError("calendar_unavailable", busy);
      throw new BookingError("server_error", friendly.server);
    }
  }
  let updated: Booking = claimed;
  log.info("booking.cancel", "Booking cancelled (Neon + Outlook consistent)", { reference: row.bookingReference, by: opts.by });

  // 2b. The deposit: refunded (online cancellation in time, or the owner's choice) or kept. Never undoes anything.
  const deposit = await settleDepositOnCancel(updated, Boolean(opts.refundDeposit));

  if (opts.silent) return updated;

  const s = summaryOf(updated, 0); // local start/end times only
  const details: CancellationDetails = {
    reference: updated.bookingReference,
    parentName: updated.parentName,
    email: updated.email,
    phone: updated.phone,
    bundleName: updated.packageName,
    date: updated.sessionDate,
    start: s.start,
    end: s.end,
    reason,
    cancelledAt,
    cancelledBy: opts.by,
    deposit,
  };
  const themeId = await activeThemeId();
  const cfg = emailConfig();
  const [customer, internal] = await Promise.allSettled([
    (async () => {
      const m = await bookingCancellationEmail(details, { themeId });
      return sendEmail({ scope: "resend.cancellation", to: updated.email, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments, replyTo: cfg.notify, idempotencyKey: `booking-cancellation/${updated.bookingReference}`, reference: updated.bookingReference });
    })(),
    (async () => {
      const m = await internalCancellationEmail(details);
      return sendEmail({ scope: "resend.internal-cancellation", from: cfg.internalFrom, to: cfg.notify, subject: m.subject, html: m.html, text: m.text, replyTo: updated.email, idempotencyKey: `booking-internal-cancellation/${updated.bookingReference}`, reference: updated.bookingReference });
    })(),
  ]);
  const why = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? (r.reason instanceof EmailSendError ? r.reason.code : "send_failed") : null);
  const now = new Date();
  try {
    [updated] = await db
      .update(bookings)
      .set({
        cancellationEmailSent: customer.status === "fulfilled",
        cancellationEmailSentAt: customer.status === "fulfilled" ? now : null,
        cancellationEmailError: why(customer),
        internalCancellationSent: internal.status === "fulfilled",
        internalCancellationSentAt: internal.status === "fulfilled" ? now : null,
        internalCancellationError: why(internal),
        updatedAt: now,
      })
      .where(eq(bookings.id, row.id))
      .returning();
  } catch (err) {
    log.error("booking.db", "Could not record cancellation email status", { error: err as Error, reference: row.bookingReference });
  }
  return updated;
}
