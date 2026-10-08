import "server-only";
import { after } from "next/server";
import { and, desc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import { getAvailabilityRules } from "@/lib/availability/server";
import { manageTokenFor } from "@/lib/booking/cancel-token";
import { confirmBookingRow } from "@/lib/booking/confirm";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { addressOf, detailsFromRow, snapshotOf } from "@/lib/booking/details";
import { BookingError } from "@/lib/booking/errors";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import { noticeHoursFor } from "@/lib/booking/terms";
import type { BookingResult } from "@/lib/booking/types";
import { getDb } from "@/lib/db/client";
import { bookingDeposits, bookingEmails, bookings, type Booking, type BookingDeposit } from "@/lib/db/schema";
import { depositAbandonedEmail } from "@/lib/email";
import { fill } from "@/lib/email/messages";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { depositReturnPath } from "@/lib/payments/link";
import { createCheckoutSession, expireCheckoutSession, getCheckoutSession, isStripeConfigured, StripeError, type CheckoutSession } from "@/lib/payments/stripe";
import { formatMoney } from "@/lib/pricing/engine";
import { releaseCodeUsage } from "@/lib/pricing/server";
import { getSiteSettings } from "@/lib/settings/server";
import { sendScheduleEvent } from "@/lib/tracking/meta-capi";
import en from "@/messages/en.json";
import { refundDeposit } from "./refund";
import { dbReason, depositOf, isMissingTable } from "./server";
import { DEPOSIT_HOLD_MINUTES, type DepositReturnState } from "./types";

/**
 * The deposit, paid on Stripe Checkout as the last step of booking:
 * 1. The booking is saved as "pending" (it blocks its time like any booking) with a booking_deposits row, and the
 *    family goes to a Stripe page that expires after ~30 minutes.
 * 2. Paid (webhook, or the page they come back to, whichever is first) → the booking is confirmed: Outlook event,
 *    confirmation + studio emails, Meta "Schedule". A short lease on the deposit row makes one request do it.
 * 3. Not paid by the time the page expires (webhook checkout.session.expired, or the sweep that runs with availability
 *    and the daily cron) → the time is released (booking cancelled, discount code use given back) and the family gets
 *    one "Your date isn't confirmed yet" email.
 * Stripe down while booking → booked without the deposit ("unpaid", flagged in /admin; the payment link takes it).
 */

const base = () => site.url.replace(/\/$/, "");
/** One request finishes a paid booking; if it crashes or the calendar is down, the next try waits this long. */
const LEASE_MS = 2 * 60_000;
/** Stripe closes the page at hold_until; a little slack before settling it ourselves. */
const GRACE_MS = 60_000;
const EXPIRED_REASON = "Deposit not paid (the payment page expired, so the time was released)";
const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const totalCents = (row: Booking) => (row.finalPriceCents ?? row.packagePrice * 100) + (row.travelFeeCents ?? 0);
const stripeCode = (err: unknown) => (err instanceof StripeError ? err.code : err instanceof BookingError ? err.code : undefined);

/** The family's browser (for Meta's Conversions API) when they come back from Stripe themselves. */
export interface ClientContext {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}

async function markUnpaid(bookingId: string, amountCents: number, reference: string) {
  await getDb()
    .insert(bookingDeposits)
    .values({ bookingId, amountCents, status: "unpaid" })
    .onConflictDoUpdate({ target: bookingDeposits.bookingId, set: { status: "unpaid", holdUntil: null, updatedAt: new Date() } })
    .catch((err) => log.error("deposit", "Couldn't flag the deposit as not paid", { reference, error: dbReason(err) }));
}

/**
 * Opens the Stripe page for the deposit of a booking that was just saved as pending. Null when Stripe can't (not set
 * up, or not reachable): the caller then confirms the booking without it.
 */
export async function openDeposit(row: Booking, amountCents: number, noticeHours: number, now = new Date()): Promise<NonNullable<BookingResult["deposit"]> | null> {
  const reference = row.bookingReference;
  const returnPath = depositReturnPath(reference, row.packageId);
  if (!returnPath || !isStripeConfigured()) {
    log.error("deposit", "Deposit is on, but STRIPE_SECRET_KEY or ADMIN_SESSION_SECRET is missing: booked without it", { reference });
    await markUnpaid(row.id, amountCents, reference);
    return null;
  }
  // a minute over Stripe's 30-minute minimum, so the request's own travel time can't make it too short
  const holdUntil = new Date(now.getTime() + (DEPOSIT_HOLD_MINUTES + 1) * 60_000);
  const db = getDb();
  try {
    await db.insert(bookingDeposits).values({ bookingId: row.id, amountCents, status: "pending", holdUntil });
  } catch (err) {
    log.error("deposit", "Deposit row not saved: booked without it", { reference, error: dbReason(err) });
    return null;
  }
  try {
    const session = await createCheckoutSession({
      amountCents,
      productName: fill(en.deposit.stripe.product, { bundle: row.packageName }),
      description: fill(en.deposit.stripe.description, { date: formatLongDate(row.sessionDate), time: formatTimeLabel(localTime(row.sessionStart, row.timezone)), total: formatMoney(totalCents(row)) }),
      customerEmail: row.email,
      reference,
      bookingId: row.id,
      successUrl: `${base()}${returnPath}&paid=1`,
      cancelUrl: `${base()}${returnPath}`,
      idempotencyKey: `deposit/${row.id}`,
      kind: "deposit",
      expiresAt: Math.floor(holdUntil.getTime() / 1000),
      submitMessage: fill(en.deposit.stripe.message, { notice: noticeLabel(noticeHours) }),
    });
    if (!session.url) throw new StripeError("no_url", "Stripe returned no payment page URL");
    await db
      .update(bookingDeposits)
      .set({ stripeSessionId: session.id, updatedAt: new Date() })
      .where(eq(bookingDeposits.bookingId, row.id))
      .catch((err) => log.error("deposit", "Stripe page id not saved (the webhook still finds the booking)", { reference, error: dbReason(err) }));
    log.info("deposit", "Deposit page opened", { reference });
    return { amountCents, status: "pending", url: session.url, returnPath, holdUntil: holdUntil.toISOString() };
  } catch (err) {
    log.error("deposit", "Stripe couldn't open the deposit page: booked without it", { reference, code: stripeCode(err), error: err instanceof StripeError ? undefined : (err as Error) });
    await markUnpaid(row.id, amountCents, reference);
    return null;
  }
}

/** A retry of a booking whose deposit page is still open: the same page again (null if there's none). */
export async function reopenDeposit(row: Booking): Promise<NonNullable<BookingResult["deposit"]> | null> {
  const d = await depositOf(row.id);
  const returnPath = depositReturnPath(row.bookingReference, row.packageId);
  if (d?.status !== "pending" || !d.stripeSessionId || !returnPath) return null;
  const session = await getCheckoutSession(d.stripeSessionId).catch(() => null);
  if (session?.status !== "open" || !session.url) return null;
  return { amountCents: d.amountCents, status: "pending", url: session.url, returnPath, holdUntil: d.holdUntil?.toISOString() };
}

export type PaidOutcome = "confirmed" | "confirming" | "failed" | "recorded" | "unknown";

/**
 * Stripe says a deposit page was paid (webhook, the page the family comes back to, the sweep, or the owner's "Check
 * with Stripe"). Records it and, while the booking is pending, confirms it. Safe to call twice.
 * "failed": paid, but the booking couldn't be confirmed yet (the calendar was down): it's tried again later.
 */
export async function depositPaid(bookingId: string, session: CheckoutSession, client: ClientContext = {}): Promise<PaidOutcome> {
  const db = getDb();
  const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!row) {
    log.warn("deposit", "Paid deposit for an unknown booking", { reference: session.client_reference_id ?? undefined });
    return "unknown";
  }
  const now = new Date();
  const paid = { status: "paid", paidAt: now, stripeSessionId: session.id, stripePaymentIntent: session.payment_intent, updatedAt: now };
  const [changed] = await db
    .insert(bookingDeposits)
    .values({ bookingId, amountCents: session.amount_total ?? 0, ...paid })
    .onConflictDoUpdate({ target: bookingDeposits.bookingId, set: paid, setWhere: sql`${bookingDeposits.status} in ('pending', 'unpaid', 'expired')` })
    .returning({ bookingId: bookingDeposits.bookingId });
  if (row.status === "pending") return confirmPaid(row, client);
  if (changed && row.status === "cancelled") {
    // Not normally possible (a time is only released once Stripe has closed its page): give the money back.
    log.error("deposit", "Deposit paid for a cancelled booking: refunding it", { reference: row.bookingReference });
    await refundDeposit(row);
    return "recorded";
  }
  if (changed) log.info("deposit", "Deposit paid", { reference: row.bookingReference });
  return "recorded";
}

/** Confirms a pending booking whose deposit is paid (one request at a time: the lease on the deposit row). */
async function confirmPaid(row: Booking, client: ClientContext): Promise<"confirmed" | "confirming" | "failed"> {
  const db = getDb();
  const now = new Date();
  const [lease] = await db
    .update(bookingDeposits)
    .set({ confirmingAt: now })
    .where(and(eq(bookingDeposits.bookingId, row.id), eq(bookingDeposits.status, "paid"), or(isNull(bookingDeposits.confirmingAt), lt(bookingDeposits.confirmingAt, new Date(now.getTime() - LEASE_MS)))))
    .returning({ bookingId: bookingDeposits.bookingId });
  if (!lease) return "confirming";
  const [current] = await db.select().from(bookings).where(eq(bookings.id, row.id)).limit(1);
  if (current?.status !== "pending") return current && current.status !== "cancelled" ? "confirmed" : "failed";
  const token = manageTokenFor(current.id);
  if (!token) {
    log.error("deposit", "Paid, but ADMIN_SESSION_SECRET is missing, so the booking can't be confirmed", { reference: current.bookingReference });
    return "failed";
  }
  try {
    const [details, rules] = await Promise.all([detailsFromRow(current), getAvailabilityRules()]);
    const noticeHours = await noticeHoursFor(current, rules.limits.rescheduleNoticeHours);
    await confirmBookingRow(current, details, { manageToken: token.token, noticeHours });
    scheduleEvent(current, client);
    return "confirmed";
  } catch (err) {
    // the lease stays, so the next try (webhook retry, the family's page, the sweep) comes after LEASE_MS
    log.error("deposit", "Deposit paid, but the booking couldn't be confirmed yet (tried again in 2 minutes)", { reference: current.bookingReference, code: stripeCode(err) });
    return "failed";
  }
}

/** Meta "Schedule" once the booking is confirmed (same event id as the browser Pixel: the requestId). Never throws. */
function scheduleEvent(row: Booking, client: ClientContext) {
  const address = addressOf(row.locationAddress);
  const fbc = client.fbc ?? (row.fbclid ? `fb.1.${(row.firstTouchAt ?? row.createdAt).getTime()}.${row.fbclid}` : undefined);
  const send = () =>
    sendScheduleEvent({
      eventId: row.requestId ?? row.bookingReference,
      eventSourceUrl: `${base()}${scheduleHref(row.packageId)}`,
      value: totalCents(row) / 100,
      bundleId: row.packageId,
      bundleName: row.packageName,
      contact: { parentName: row.parentName, email: row.email, phone: row.phone },
      address: { city: address.city, zip: address.zip },
      client: { ...client, fbc },
    });
  try {
    after(send);
  } catch {
    void send();
  }
}

/** The Stripe page of a deposit expired (webhook): release the time if it's still waiting on that page. */
export async function depositPageExpired(bookingId: string, session: CheckoutSession): Promise<void> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (row?.status !== "pending") return;
  const d = await depositOf(row.id);
  if (d?.status !== "pending" || (d.stripeSessionId && d.stripeSessionId !== session.id)) return;
  await releaseHold(row, { email: true, why: EXPIRED_REASON });
}

/**
 * Frees the time of a booking whose deposit wasn't paid: the booking is cancelled (kept as a lead), the deposit marked
 * expired and a discount code use given back. With `email`, the family gets one "Your date isn't confirmed yet" email.
 */
async function releaseHold(row: Booking, opts: { email: boolean; why: string }): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const [cancelled] = await db
    .update(bookings)
    .set({ status: "cancelled", cancellationReason: opts.why, cancelledAt: now, updatedAt: now })
    .where(and(eq(bookings.id, row.id), eq(bookings.status, "pending")))
    .returning({ id: bookings.id });
  if (!cancelled) {
    // confirmed meanwhile (paid at the last second), or already released
    const [current] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, row.id)).limit(1);
    if (current?.status !== "cancelled") return false;
  }
  await db.update(bookingDeposits).set({ status: "expired", updatedAt: now }).where(and(eq(bookingDeposits.bookingId, row.id), eq(bookingDeposits.status, "pending")));
  if (!cancelled) return false;
  await releaseCodeUsage(row.id).catch((err) => log.error("deposit", "Discount code use not given back", { reference: row.bookingReference, error: dbReason(err) }));
  log.info("deposit", "Time released (deposit not paid)", { reference: row.bookingReference, email: opts.email });
  if (opts.email) await sendAbandonedEmail(row);
  return true;
}

/** "Your date isn't confirmed yet" + a link to pick a time again. Once per booking; skipped if they booked again since. */
async function sendAbandonedEmail(row: Booking): Promise<void> {
  const db = getDb();
  const [rebooked] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(sql`lower(${bookings.email})`, row.email.toLowerCase()), ne(bookings.status, "cancelled"), gt(bookings.createdAt, row.createdAt)))
    .orderBy(desc(bookings.createdAt))
    .limit(1)
    .catch(() => []);
  if (rebooked) return;
  const [claim] = await db
    .insert(bookingEmails)
    .values({ bookingId: row.id, kind: "deposit_abandoned", sessionStart: row.sessionStart })
    .onConflictDoNothing()
    .returning({ id: bookingEmails.id })
    .catch((err) => {
      log.error("deposit", "Couldn't claim the 'not confirmed yet' email", { reference: row.bookingReference, error: dbReason(err) });
      return [];
    });
  if (!claim) return;
  try {
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    const mail = await depositAbandonedEmail(
      { parentName: row.parentName, bundleName: row.packageName, date: row.sessionDate, start: localTime(row.sessionStart, row.timezone) },
      { themeId, bookUrl: `${base()}${scheduleHref(row.packageId)}` },
    );
    const { id: resendId } = await sendEmail({
      scope: "resend.deposit_abandoned",
      to: row.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `deposit-abandoned/${row.bookingReference}`,
      reference: row.bookingReference,
    });
    await db.update(bookingEmails).set({ status: "sent", resendId, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id));
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("deposit", "'Not confirmed yet' email not sent", { reference: row.bookingReference, code });
    await db.update(bookingEmails).set({ status: "failed", error: code, updatedAt: new Date() }).where(eq(bookingEmails.id, claim.id)).catch(() => undefined);
  }
}

/** Settles one waiting deposit with Stripe: paid → confirm; page closed → release; still open → leave it. */
async function settleWithStripe(row: Booking, d: BookingDeposit, opts: { email: boolean; closeOpen: boolean; client?: ClientContext; why?: string }): Promise<"paid" | "released" | "open" | "unknown"> {
  let session = d.stripeSessionId ? await getCheckoutSession(d.stripeSessionId) : null;
  if (session?.payment_status === "paid") {
    await depositPaid(row.id, session, opts.client);
    return "paid";
  }
  if (session?.status === "open") {
    if (!opts.closeOpen) return "open";
    try {
      session = await expireCheckoutSession(session.id);
    } catch {
      // paid or closed in the meantime: ask again
      session = await getCheckoutSession(session.id);
    }
    if (session.payment_status === "paid") {
      await depositPaid(row.id, session, opts.client);
      return "paid";
    }
    if (session.status !== "expired") return "unknown";
  }
  // expired page, or none was ever saved (its page, if any, expired at hold_until too)
  if (!session && !opts.closeOpen && d.holdUntil && d.holdUntil.getTime() + GRACE_MS > Date.now()) return "open";
  return (await releaseHold(row, { email: opts.email, why: opts.why ?? (opts.email ? EXPIRED_REASON : "Deposit not paid (the family picked another time)") })) ? "released" : "unknown";
}

/**
 * Deposits that need settling: pages past their expiry (paid at the last second → confirm; else release + email) and
 * paid deposits whose booking still isn't confirmed (a crash or a calendar outage). Runs after availability checks,
 * before a booking is saved, and with the daily cron. Cheap when there's nothing to do; never throws.
 */
export async function sweepDeposits(now = new Date(), limit = 5): Promise<{ released: number; confirmed: number }> {
  const db = getDb();
  const out = { released: 0, confirmed: 0 };
  let due: { deposit: BookingDeposit; booking: Booking }[];
  try {
    due = await db
      .select({ deposit: bookingDeposits, booking: bookings })
      .from(bookingDeposits)
      .innerJoin(bookings, eq(bookings.id, bookingDeposits.bookingId))
      .where(
        and(
          eq(bookings.status, "pending"),
          or(
            and(eq(bookingDeposits.status, "pending"), lt(bookingDeposits.holdUntil, new Date(now.getTime() - GRACE_MS))),
            and(eq(bookingDeposits.status, "paid"), or(isNull(bookingDeposits.confirmingAt), lt(bookingDeposits.confirmingAt, new Date(now.getTime() - LEASE_MS)))),
          ),
        ),
      )
      .limit(limit);
  } catch (err) {
    if (!isMissingTable(err)) log.error("deposit", "Sweep: couldn't look for waiting deposits", { error: dbReason(err) });
    return out;
  }
  for (const { deposit, booking } of due) {
    try {
      if (deposit.status === "paid") {
        if ((await confirmPaid(booking, {})) === "confirmed") out.confirmed++;
        continue;
      }
      const r = await settleWithStripe(booking, deposit, { email: true, closeOpen: true });
      if (r === "released") out.released++;
      if (r === "paid") out.confirmed++;
    } catch (err) {
      log.error("deposit", "Sweep: couldn't settle a deposit (tried again later)", { reference: booking.bookingReference, code: stripeCode(err) });
    }
  }
  if (out.released || out.confirmed) log.info("deposit", "Sweep settled deposits", out);
  return out;
}

/** The booking page after Stripe (or after Back): what to show, asking Stripe while the deposit is still waiting. */
export async function depositReturnState(reference: string, client: ClientContext = {}): Promise<DepositReturnState> {
  const db = getDb();
  const load = async () => {
    const [row] = await db.select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
    return { row, deposit: row ? await depositOf(row.id) : null };
  };
  let { row, deposit } = await load();
  if (!row) return { state: "invalid" };
  let payUrl: string | null = null;
  if (row.status === "pending" && deposit?.status === "pending") {
    const r = await settleWithStripe(row, deposit, { email: false, closeOpen: false, client }).catch((err) => {
      log.error("deposit", "Couldn't check the deposit with Stripe", { reference, code: stripeCode(err) });
      return "unknown" as const;
    });
    if (r === "open" && deposit.stripeSessionId) payUrl = (await getCheckoutSession(deposit.stripeSessionId).catch(() => null))?.url ?? null;
    ({ row, deposit } = await load());
  } else if (row.status === "pending" && deposit?.status === "paid") {
    await confirmPaid(row, client);
    ({ row, deposit } = await load());
  }
  if (!row) return { state: "invalid" };
  const start = localTime(row.sessionStart, row.timezone);
  if (row.status === "confirmed" || row.status === "rescheduled") return { state: "confirmed", booking: await resultOf(row), requestId: row.requestId };
  if (row.status === "pending" && deposit?.status === "paid") return { state: "confirming" };
  if (row.status === "pending")
    return { state: "waiting", amountCents: deposit?.amountCents ?? 0, holdUntil: deposit?.holdUntil?.toISOString() ?? null, date: row.sessionDate, start, end: localTime(row.sessionEnd, row.timezone), bundleName: row.packageName, payUrl };
  if (deposit?.status === "expired") return { state: "expired", date: row.sessionDate, start, bundleName: row.packageName };
  return { state: "invalid" };
}

/** "Pick another time": closes the Stripe page and frees the time now (no email: they're rebooking). */
export async function releaseByFamily(reference: string): Promise<DepositReturnState> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  const d = row ? await depositOf(row.id) : null;
  if (row?.status === "pending" && d?.status === "pending") {
    const r = await settleWithStripe(row, d, { email: false, closeOpen: true }).catch(() => "unknown" as const);
    if (r === "unknown" || r === "open") throw new BookingError("server_error", en.deposit.return.error);
  }
  return depositReturnState(reference);
}

/** Before deleting a lead that's still on its deposit page: closes the page and releases the time. False if Stripe couldn't. */
export async function closeDepositPage(row: Booking, why?: string): Promise<boolean> {
  const d = await depositOf(row.id);
  if (d?.status !== "pending") return true;
  const r = await settleWithStripe(row, d, { email: false, closeOpen: true, why }).catch(() => "unknown" as const);
  return r !== "unknown" && r !== "open";
}

/** The confirmed booking as the booking page's confirmation shows it (the family's own details, via the signed link). */
async function resultOf(row: Booking): Promise<BookingResult> {
  const [details, rules] = await Promise.all([detailsFromRow(row), getAvailabilityRules()]);
  return {
    id: row.bookingReference,
    status: "confirmed",
    createdAt: row.createdAt.toISOString(),
    emailSent: row.confirmationEmailSent,
    pricing: snapshotOf(row),
    travel: { feeCents: row.travelFeeCents, miles: row.travelMiles },
    rescheduleNoticeHours: await noticeHoursFor(row, rules.limits.rescheduleNoticeHours),
    deposit: details.deposit,
    request: {
      bundleId: row.packageId,
      slot: { id: `${details.date}T${details.start}`, date: details.date, start: details.start, end: details.end, label: formatTimeLabel(details.start) },
      contact: details.contact,
      address: details.address,
      inspirationPhotoId: row.inspirationPhotoId ?? undefined,
      backdrops: details.backdrops,
    },
  };
}
