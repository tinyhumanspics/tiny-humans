import "server-only";
import { createHmac } from "crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { getDb } from "@/lib/db/client";
import { bookingEmails, bookingRescheduleHistory, bookings, type Booking, type BookingEmail } from "@/lib/db/schema";
import { getAvailabilityRules } from "@/lib/availability/server";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { sessionReminderEmail, type ReminderKind } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings/server";
import { log } from "@/lib/log";
import { hashCancelToken } from "./cancel-token";
import { managedOf, manageUrls } from "./reschedule";
import { termsFor } from "./terms";
import { accessFor } from "./access";
import { backdropsFor } from "./backdrops";
import { canChangeBackdrop } from "./backdrop-page";
import { addDaysKey, todayInZone } from "./timezone";
import { depositsFor } from "@/lib/deposit/server";

/**
 * Session reminders, sent by a once-a-day cron (Vercel Hobby). Everything is decided at send time from the booking
 * as it is now, so reschedules and cancellations need no extra bookkeeping, and bookings made before reminders
 * existed are covered too. Each run also catches up on what a missed or failed run left behind.
 *
 * - "72h" (prep guide + a big reschedule button): session 2–3 days away (studio dates), only if the booking was
 *   confirmed (made or last rescheduled) at least 72 h before the session.
 * - "24h" (logistics): session today or tomorrow and at least 3 h away, only if confirmed at least 24 h before.
 *
 * A row in booking_emails claims each email (unique per booking + kind + session time), so concurrent or duplicate
 * cron runs can't send twice. Failed sends are retried by later runs (up to 3 attempts) while still due.
 */
export const REMINDER_KINDS = { "72h": "reminder_72h", "24h": "reminder_24h" } as const satisfies Record<ReminderKind, string>;
const HOUR = 3_600_000;
const MAX_ATTEMPTS = 3;
/** A "sending" row older than this belongs to a run that crashed mid-send. */
const STALE_MS = 15 * 60_000;

export interface ReminderRunResult {
  today: string;
  dryRun: boolean;
  /** References of bookings that got (or, in a dry run, would get) each reminder. */
  sent: { reference: string; kind: ReminderKind }[];
  failed: { reference: string; kind: ReminderKind; code: string }[];
}

function dueKind(row: Booking, confirmedAt: Date, today: string, now: Date): ReminderKind | null {
  const start = row.sessionStart.getTime();
  const lead = start - confirmedAt.getTime();
  if (start <= now.getTime()) return null;
  if ((row.sessionDate === addDaysKey(today, 2) || row.sessionDate === addDaysKey(today, 3)) && lead >= 72 * HOUR) return "72h";
  if ((row.sessionDate === today || row.sessionDate === addDaysKey(today, 1)) && start - now.getTime() >= 3 * HOUR && lead >= 24 * HOUR) return "24h";
  return null;
}

function claimable(existing: BookingEmail | undefined, now: Date): boolean {
  if (!existing) return true;
  if (existing.status === "failed") return existing.attempts < MAX_ATTEMPTS;
  return existing.status === "sending" && now.getTime() - existing.updatedAt.getTime() > STALE_MS;
}

/** The reschedule-link token for one reminder row: derived from a server secret, so a retry sends the same link. */
function linkToken(emailId: string, secret: string): string {
  return createHmac("sha256", secret).update(`booking-email-link:${emailId}`).digest("base64url");
}

export async function runReminders(opts: { secret: string; now?: Date; dryRun?: boolean }): Promise<ReminderRunResult> {
  const now = opts.now ?? new Date();
  const dryRun = Boolean(opts.dryRun);
  const today = todayInZone(bookingRules.timeZone, now);
  const result: ReminderRunResult = { today, dryRun, sent: [], failed: [] };
  const db = getDb();

  const rows = await db
    .select()
    .from(bookings)
    // booked ones only (not a booking still waiting on its deposit page)
    .where(and(inArray(bookings.status, ["confirmed", "rescheduled"]), gte(bookings.sessionDate, today), lte(bookings.sessionDate, addDaysKey(today, 3))));
  if (!rows.length) return result;
  const ids = rows.map((r) => r.id);
  const [history, sentRows] = await Promise.all([
    db.select({ bookingId: bookingRescheduleHistory.bookingId, at: sql<Date>`max(${bookingRescheduleHistory.createdAt})`.mapWith(bookingRescheduleHistory.createdAt) }).from(bookingRescheduleHistory).where(inArray(bookingRescheduleHistory.bookingId, ids)).groupBy(bookingRescheduleHistory.bookingId),
    db.select().from(bookingEmails).where(inArray(bookingEmails.bookingId, ids)),
  ]);
  const lastReschedule = new Map(history.map((h) => [h.bookingId, h.at]));

  const due = rows.flatMap((row) => {
    const rescheduled = lastReschedule.get(row.id);
    const confirmedAt = rescheduled && rescheduled > row.createdAt ? rescheduled : row.createdAt;
    const kind = dueKind(row, confirmedAt, today, now);
    if (!kind) return [];
    const existing = sentRows.find((e) => e.bookingId === row.id && e.kind === REMINDER_KINDS[kind] && e.sessionStart.getTime() === row.sessionStart.getTime());
    return claimable(existing, now) ? [{ row, kind }] : [];
  });
  if (dryRun) {
    result.sent = due.map(({ row, kind }) => ({ reference: row.bookingReference, kind }));
    return result;
  }
  if (!due.length) return result;

  const dueIds = due.map((d) => d.row.id);
  const [rules, themeId, terms, access, picks, deposits] = await Promise.all([getAvailabilityRules(), getSiteSettings().then((s) => s.themeId).catch(() => "default"), termsFor(dueIds), accessFor(dueIds), backdropsFor(dueIds), depositsFor(dueIds)]);
  for (const { row, kind } of due) {
    const reference = row.bookingReference;
    const [claim] = await db
      .insert(bookingEmails)
      .values({ bookingId: row.id, kind: REMINDER_KINDS[kind], sessionStart: row.sessionStart })
      .onConflictDoUpdate({
        target: [bookingEmails.bookingId, bookingEmails.kind, bookingEmails.sessionStart],
        set: { status: "sending", attempts: sql`${bookingEmails.attempts} + 1`, error: null, updatedAt: now },
        setWhere: sql`(${bookingEmails.status} = 'failed' and ${bookingEmails.attempts} < ${MAX_ATTEMPTS}) or (${bookingEmails.status} = 'sending' and ${bookingEmails.updatedAt} < ${new Date(now.getTime() - STALE_MS)})`,
      })
      .returning({ id: bookingEmails.id });
    if (!claim) continue; // another run has it

    try {
      const managed = managedOf(row, rules, now, terms.find((t) => t.bookingId === row.id)?.noticeHours ?? rules.limits.rescheduleNoticeHours);
      let rescheduleUrl: string | undefined;
      let backdropUrl: string | undefined;
      const canBackdrop = canChangeBackdrop(row, now);
      if (kind === "72h" && (managed.canReschedule || canBackdrop)) {
        const token = linkToken(claim.id, opts.secret);
        await db.update(bookingEmails).set({ linkTokenHash: hashCancelToken(token) }).where(eq(bookingEmails.id, claim.id));
        const links = manageUrls(token, row.locale);
        if (managed.canReschedule) rescheduleUrl = links.reschedule;
        if (canBackdrop) backdropUrl = links.backdrop;
      }
      const mail = await sessionReminderEmail(
        kind,
        { reference, parentName: row.parentName, bundleName: row.packageName, date: row.sessionDate, start: managed.start, end: managed.end, location: row.locationAddress, accessNotes: access.find((a) => a.bookingId === row.id)?.notes, backdrops: picks.find((b) => b.bookingId === row.id)?.picks, depositPaid: deposits.some((d) => d.bookingId === row.id && d.status === "paid") },
        { themeId, today, rescheduleUrl, backdropUrl, rescheduleNoticeHours: managed.rescheduleNoticeHours, locale: row.locale },
      );
      const { id } = await sendEmail({
        scope: `resend.reminder-${kind}`,
        to: row.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
        replyTo: emailConfig().notify,
        idempotencyKey: `${REMINDER_KINDS[kind]}/${reference}/${row.sessionStart.toISOString()}`,
        reference,
      });
      await db.update(bookingEmails).set({ status: "sent", resendId: id, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id));
      result.sent.push({ reference, kind });
    } catch (err) {
      const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
      log.error("reminders", "Reminder not sent", { reference, kind, code, error: err instanceof EmailSendError ? undefined : (err as Error) });
      await db
        .update(bookingEmails)
        .set({ status: "failed", error: code, updatedAt: new Date() })
        .where(eq(bookingEmails.id, claim.id))
        .catch((e) => log.error("reminders", "Could not record the failure", { reference, error: e as Error }));
      result.failed.push({ reference, kind, code });
    }
  }
  log.info("reminders", "Reminder run finished", { today, sent: result.sent.length, failed: result.failed.length });
  return result;
}
