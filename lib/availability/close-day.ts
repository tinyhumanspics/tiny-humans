import "server-only";
import { createHmac } from "crypto";
import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import { hashCancelToken } from "@/lib/booking/cancel-token";
import { manageUrls } from "@/lib/booking/reschedule";
import { closeDepositPage } from "@/lib/deposit/flow";
import { bookingEmails, bookings, type Booking, type BookingEmail } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { dayClosedEmail } from "@/lib/email";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { getSiteSettings } from "@/lib/settings/server";
import { log } from "@/lib/log";
import type { CloseDayResult, ClosedDayBooking, ClosedDayImpact } from "./types";
import { getAvailabilityRules, upsertOverride } from "./server";

const KIND = "day_closed";
const CLOSED_DEPOSIT_REASON = "Date closed by Tiny Humans before the deposit was paid";
const MAX_ATTEMPTS = 3;
const STALE_MS = 15 * 60_000;
const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

async function affectedRows(date: string, now = new Date()): Promise<Booking[]> {
  const db = getDb();
  const [active, retryClosedDeposits] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.sessionDate, date), inArray(bookings.status, ["pending", "confirmed", "rescheduled"]), gt(bookings.sessionStart, now)))
      .orderBy(asc(bookings.sessionStart)),
    db
      .select({ booking: bookings })
      .from(bookingEmails)
      .innerJoin(bookings, eq(bookings.id, bookingEmails.bookingId))
      .where(
        and(
          eq(bookings.sessionDate, date),
          eq(bookings.status, "cancelled"),
          eq(bookings.cancellationReason, CLOSED_DEPOSIT_REASON),
          gt(bookings.sessionStart, now),
          eq(bookingEmails.kind, KIND),
          ne(bookingEmails.status, "sent"),
        ),
      )
      .orderBy(asc(bookings.sessionStart)),
  ]);
  return [...active, ...retryClosedDeposits.map((item) => item.booking)].sort((a, b) => a.sessionStart.getTime() - b.sessionStart.getTime());
}

function notificationFor(row: Booking, emails: BookingEmail[]): ClosedDayBooking["notification"] {
  const email = emails.find((item) => item.bookingId === row.id && item.kind === KIND && item.sessionStart.getTime() === row.sessionStart.getTime());
  return email ? { status: email.status as "sending" | "sent" | "failed", error: email.error } : null;
}

function impactOf(date: string, rows: Booking[], emails: BookingEmail[]): ClosedDayImpact {
  return {
    date,
    bookings: rows.map((row) => ({
      reference: row.bookingReference,
      parentName: row.parentName,
      email: row.email,
      phone: row.phone,
      start: localTime(row.sessionStart, row.timezone),
      end: localTime(row.sessionEnd, row.timezone),
      status: row.status as ClosedDayBooking["status"],
      notification: notificationFor(row, emails),
    })),
  };
}

/** Active future sessions that remain on a date even if new bookings are blocked. */
export async function getClosedDayImpact(date: string): Promise<ClosedDayImpact> {
  const rows = await affectedRows(date);
  const ids = rows.map((row) => row.id);
  const emails = ids.length ? await getDb().select().from(bookingEmails).where(and(inArray(bookingEmails.bookingId, ids), eq(bookingEmails.kind, KIND))) : [];
  return impactOf(date, rows, emails);
}

function emailToken(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`day-closed-link:v1:${id}`).digest("base64url");
}

async function claimEmail(row: Booking, now: Date): Promise<{ id: string } | null> {
  const [claim] = await getDb()
    .insert(bookingEmails)
    .values({ bookingId: row.id, kind: KIND, sessionStart: row.sessionStart })
    .onConflictDoUpdate({
      target: [bookingEmails.bookingId, bookingEmails.kind, bookingEmails.sessionStart],
      set: { status: "sending", attempts: sql`${bookingEmails.attempts} + 1`, error: null, updatedAt: now },
      setWhere: sql`(${bookingEmails.status} = 'failed' and ${bookingEmails.attempts} < ${MAX_ATTEMPTS}) or (${bookingEmails.status} = 'sending' and ${bookingEmails.updatedAt} < ${new Date(now.getTime() - STALE_MS)})`,
    })
    .returning({ id: bookingEmails.id });
  return claim ?? null;
}

async function existingEmail(row: Booking): Promise<BookingEmail | null> {
  const [email] = await getDb()
    .select()
    .from(bookingEmails)
    .where(and(eq(bookingEmails.bookingId, row.id), eq(bookingEmails.kind, KIND), eq(bookingEmails.sessionStart, row.sessionStart)))
    .limit(1);
  return email ?? null;
}

type SendOutcome = { status: "sent" | "alreadySent" | "failed" | "skipped"; reference: string; error?: string };

async function notifyOne(original: Booking, note: string | undefined, themeId: string): Promise<SendOutcome> {
  const [latest] = await getDb().select().from(bookings).where(eq(bookings.id, original.id)).limit(1);
  if (!latest || latest.sessionStart.getTime() !== original.sessionStart.getTime()) return { status: "skipped", reference: original.bookingReference };
  let row = latest;
  let pending = row.status === "pending" || (row.status === "cancelled" && row.cancellationReason === CLOSED_DEPOSIT_REASON);
  if (row.status === "cancelled" && !pending) return { status: "skipped", reference: row.bookingReference };
  if (row.status === "pending") {
    const closed = await closeDepositPage(row, CLOSED_DEPOSIT_REASON);
    const [current] = await getDb().select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
    if (!current || current.status === "pending") return { status: "failed", reference: row.bookingReference, error: closed ? "deposit_still_pending" : "deposit_page_not_closed" };
    row = current;
    // A last-second payment confirms the booking. It now needs the same protected reschedule link as any active row.
    pending = row.status === "cancelled";
  }

  const existing = await existingEmail(row);
  if (existing?.status === "sent") return { status: "alreadySent", reference: row.bookingReference };
  const now = new Date();
  const claim = await claimEmail(row, now);
  if (!claim) {
    const current = await existingEmail(row);
    return {
      status: current?.status === "sent" ? "alreadySent" : "failed",
      reference: row.bookingReference,
      error: current?.error ?? (current?.status === "sending" ? "already_sending" : "email_not_claimed"),
    };
  }

  try {
    let actionUrl: string;
    if (pending) {
      actionUrl = `${site.url.replace(/\/$/, "")}${scheduleHref(row.packageId, null, row.locale)}`;
    } else {
      const secret = process.env.ADMIN_SESSION_SECRET;
      if (!secret) throw new EmailSendError("not_configured", "ADMIN_SESSION_SECRET is not set");
      const token = emailToken(claim.id, secret);
      await getDb().update(bookingEmails).set({ linkTokenHash: hashCancelToken(token), updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id));
      actionUrl = manageUrls(token, row.locale).reschedule;
    }
    const mail = await dayClosedEmail(
      {
        reference: row.bookingReference,
        parentName: row.parentName,
        bundleName: row.packageName,
        date: row.sessionDate,
        start: localTime(row.sessionStart, row.timezone),
        end: localTime(row.sessionEnd, row.timezone),
        note,
        pending,
      },
      { themeId, actionUrl, locale: row.locale },
    );
    const { id } = await sendEmail({
      scope: "resend.day_closed",
      to: row.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `day-closed/${row.bookingReference}/${row.sessionStart.toISOString()}`,
      reference: row.bookingReference,
    });
    await getDb().update(bookingEmails).set({ status: "sent", resendId: id, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id));
    return { status: "sent", reference: row.bookingReference };
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    await getDb().update(bookingEmails).set({ status: "failed", error: code, updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id)).catch(() => undefined);
    log.error("availability.close-day", "Schedule-change email not sent", { reference: row.bookingReference, code });
    return { status: "failed", reference: row.bookingReference, error: code };
  }
}

/** Close one date first, then notify every future booking on it. Individual failures never reopen the date. */
export async function closeDayAndNotify(date: string, note?: string): Promise<CloseDayResult> {
  await upsertOverride({ date, isClosed: true });
  const rows = await affectedRows(date);
  const themeId = await getSiteSettings().then((settings) => settings.themeId).catch(() => "default");
  const outcomes: SendOutcome[] = [];
  for (const row of rows) outcomes.push(await notifyOne(row, note?.trim() || undefined, themeId));
  const impact = await getClosedDayImpact(date);
  return {
    rules: await getAvailabilityRules(),
    impact,
    sent: outcomes.filter((outcome) => outcome.status === "sent").map((outcome) => outcome.reference),
    alreadySent: outcomes.filter((outcome) => outcome.status === "alreadySent").map((outcome) => outcome.reference),
    failed: outcomes.filter((outcome) => outcome.status === "failed").map((outcome) => ({ reference: outcome.reference, error: outcome.error ?? "send_failed" })),
  };
}

/** Close one date without email. Waiting deposit pages are still closed so they cannot confirm on the blocked day. */
export async function closeDayWithoutEmail(date: string): Promise<CloseDayResult> {
  await upsertOverride({ date, isClosed: true });
  const rows = await affectedRows(date);
  const failed: CloseDayResult["failed"] = [];
  for (const row of rows) {
    if (row.status !== "pending") continue;
    const closed = await closeDepositPage(row, CLOSED_DEPOSIT_REASON);
    const [current] = await getDb().select({ status: bookings.status }).from(bookings).where(eq(bookings.id, row.id)).limit(1);
    if (!closed && current?.status === "pending") failed.push({ reference: row.bookingReference, error: "deposit_page_not_closed" });
  }
  return {
    rules: await getAvailabilityRules(),
    impact: await getClosedDayImpact(date),
    sent: [],
    alreadySent: [],
    failed,
  };
}
