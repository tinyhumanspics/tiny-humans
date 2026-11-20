import "server-only";
import { and, desc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import { getAvailabilityRules } from "@/lib/availability/server";
import { bookingRules } from "@/config/booking";
import { ownerRulesOf, slotsForDay } from "@/lib/booking/availability";
import { manageTokenFor } from "@/lib/booking/cancel-token";
import { confirmBookingRow } from "@/lib/booking/confirm";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { detailsFromRow, homeOf } from "@/lib/booking/details";
import { BookingError } from "@/lib/booking/errors";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import { busyExcluding } from "@/lib/booking/reschedule";
import { noticeHoursFor } from "@/lib/booking/terms";
import type { BookingResult } from "@/lib/booking/types";
import { getDb, isMissingTable, isOverlapViolation, isUniqueViolation } from "@/lib/db/client";
import { bookingAccess, bookingBabies, bookingDeposits, bookingEmails, bookings, discountCodes, type Booking, type BookingDeposit } from "@/lib/db/schema";
import { babiesFor, saveBabyGenders, type GenderChoice } from "@/lib/booking/addons";
import { formatAddress } from "@/lib/booking/templates";
import { depositAbandonedEmail, depositLinkEmail, internalDepositUnpaidEmail, ownerBookedEmail, ownerBookedSms } from "@/lib/email";
import type { OwnerBookedDetails } from "@/emails/OwnerBooked";
import { todayInZone } from "@/lib/booking/timezone";
import { fill } from "@/lib/email/messages";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { depositReturnPath } from "@/lib/payments/link";
import { createCheckoutSession, expireCheckoutSession, getCheckoutSession, isStripeConfigured, StripeError, type CheckoutSession } from "@/lib/payments/stripe";
import { formatMoney } from "@/lib/pricing/engine";
import { attachUsage, claimCode, releaseCodeUsage } from "@/lib/pricing/server";
import { getSiteSettings } from "@/lib/settings/server";
import { scheduleBooking } from "@/lib/tracking/schedule";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { refundDeposit } from "./refund";
import { dbReason, depositOf } from "./server";
import { DEPOSIT_HOLD_MINUTES, isOwnerBooked, payPageWindow, type DepositReturnState, type LinkBaby, type LinkHome } from "./types";
import { setupsOf } from "@/config/backdrops";
import { backdropsFor, saveBackdrops } from "@/lib/booking/backdrops";
import { getCatalog } from "@/lib/pricing/server";
import { markRequestBooked } from "@/lib/requests/store";

/**
 * The deposit, paid from the family's link after the owner confirms (brief 02: nothing is paid on /book):
 * 1. The owner's booking is saved as "pending" (it blocks its time like any booking) with a booking_deposits row held
 *    48 h; the family's link asks for their backdrops and opens a Stripe page when they press Pay (`payWithLink`).
 * 2. Paid (webhook, or the page they come back to, whichever is first) → the booking is confirmed: Outlook event,
 *    confirmation + studio emails, Meta "Schedule", and its website request marked booked. A short lease on the
 *    deposit row makes one request do it.
 * 3. Not paid while held (webhook checkout.session.expired, or the sweep that runs with availability and the daily
 *    cron) → the time is released (booking cancelled, discount code use given back) and the family gets one "Your date
 *    isn't confirmed yet" email.
 * The owner is alerted when a deposit isn't paid in time, and /admin can email or copy the family's deposit link: it
 * works while the time is held, and a released time is held again (30 minutes) if it's still free.
 */

const base = () => site.url.replace(/\/$/, "");
/** One request finishes a paid booking; if it crashes or the calendar is down, the next try waits this long. */
const LEASE_MS = 2 * 60_000;
/** Stripe closes the page at hold_until; a little slack before settling it ourselves. */
const GRACE_MS = 60_000;
const EXPIRED_REASON = "Deposit not paid (the payment page expired, so the time was released)";
const TAKEN_AGAIN = "That time isn't free anymore (another booking or a calendar event), so it can't be held again. The family can pick another time.";
const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const totalCents = (row: Booking) => (row.finalPriceCents ?? row.packagePrice * 100) + (row.addonsTotalCents ?? 0) + (row.travelFeeCents ?? 0);
const stripeCode = (err: unknown) => (err instanceof StripeError ? err.code : err instanceof BookingError ? err.code : undefined);

/** The family's browser (for Meta's Conversions API) when they come back from Stripe themselves. */
export interface ClientContext {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}

/** Opens the Stripe page of a held deposit (expiring with the hold) and saves its id. Throws when Stripe can't. */
async function createDepositPage(row: Booking, amountCents: number, noticeHours: number, holdUntil: Date, idempotencyKey: string): Promise<{ url: string }> {
  const reference = row.bookingReference;
  const returnPath = depositReturnPath(reference, row.packageId, row.locale);
  if (!returnPath) throw new StripeError("not_configured", "ADMIN_SESSION_SECRET is missing");
  const messages = row.locale === "es" ? es : en;
  const session = await createCheckoutSession({
    amountCents,
    productName: fill(messages.deposit.stripe.product, { bundle: row.packageName }),
    description: fill(messages.deposit.stripe.description, { date: formatLongDate(row.sessionDate, row.locale), time: formatTimeLabel(localTime(row.sessionStart, row.timezone), row.locale), total: formatMoney(totalCents(row)) }),
    customerEmail: row.email,
    reference,
    bookingId: row.id,
    successUrl: `${base()}${returnPath}&paid=1`,
    cancelUrl: `${base()}${returnPath}`,
    idempotencyKey,
    kind: "deposit",
    expiresAt: Math.floor(holdUntil.getTime() / 1000),
    submitMessage: fill(messages.deposit.stripe.message, { notice: noticeLabel(noticeHours, messages.policy) }),
  });
  if (!session.url) throw new StripeError("no_url", "Stripe returned no payment page URL");
  await getDb()
    .update(bookingDeposits)
    .set({ stripeSessionId: session.id, updatedAt: new Date() })
    .where(eq(bookingDeposits.bookingId, row.id))
    .catch((err) => log.error("deposit", "Stripe page id not saved (the webhook still finds the booking)", { reference, error: dbReason(err) }));
  return { url: session.url };
}

/** A retry of a booking whose deposit page is still open: the same page again (null if there's none). */
export async function reopenDeposit(row: Booking): Promise<NonNullable<BookingResult["deposit"]> | null> {
  const d = await depositOf(row.id);
  const returnPath = depositReturnPath(row.bookingReference, row.packageId, row.locale);
  if (d?.status !== "pending" || !d.stripeSessionId || !returnPath) return null;
  const session = await getCheckoutSession(d.stripeSessionId).catch(() => null);
  if (session?.status !== "open" || !session.url) return null;
  return { amountCents: d.amountCents, status: "pending", url: session.url, returnPath, holdUntil: d.holdUntil?.toISOString() };
}

/**
 * A booking the owner made for a family (/admin → Quotes / Booking, owner Nov 12): its time is held `holdHours` (48)
 * for the family's link, which asks for their backdrops and opens a Stripe page when they press Pay
 * (`payWithLink`). No page is opened now: Stripe pages close within 24 hours, and the family may open the link later.
 */
export async function openOwnerDeposit(row: Booking, amountCents: number, holdHours: number, now = new Date()): Promise<NonNullable<BookingResult["deposit"]> | null> {
  const reference = row.bookingReference;
  const returnPath = depositReturnPath(reference, row.packageId, row.locale);
  if (!returnPath) return null;
  const holdUntil = new Date(now.getTime() + holdHours * 3_600_000);
  try {
    await getDb().insert(bookingDeposits).values({ bookingId: row.id, amountCents, status: "pending", holdUntil });
  } catch (err) {
    log.error("deposit", "Deposit row not saved: booked without it", { reference, error: dbReason(err) });
    return null;
  }
  log.info("deposit", "Owner booking held for the family's link", { reference });
  return { amountCents, status: "pending", url: `${base()}${returnPath}`, returnPath, holdUntil: holdUntil.toISOString() };
}

/**
 * "Pay the deposit" on the family's link: the open Stripe page, or a new one that closes when the hold ends (30 min to
 * 24 h, see payPageWindow). Only while the time is held and the deposit isn't paid.
 */
export async function payWithLink(reference: string, now = new Date()): Promise<string> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  const d = row ? await depositOf(row.id) : null;
  const t = (row?.locale === "es" ? es : en).bookingFlow.depositReturn;
  if (!row || !d) throw new BookingError("invalid_request", t.invalidTitle);
  if (d.status === "paid" || row.status === "confirmed" || row.status === "rescheduled") throw new BookingError("invalid_request", t.confirmingTitle);
  if (row.status !== "pending" || d.status !== "pending" || !d.holdUntil || d.holdUntil.getTime() <= now.getTime()) throw new BookingError("invalid_request", t.expiredTitle);
  const open = await reopenDeposit(row).catch(() => null);
  if (open?.url) return open.url;
  if (!isStripeConfigured()) throw new BookingError("server_error", t.error);
  const window = payPageWindow(d.holdUntil, now);
  if (window.holdUntil.getTime() !== d.holdUntil.getTime()) {
    await getDb().update(bookingDeposits).set({ holdUntil: window.holdUntil, updatedAt: now }).where(eq(bookingDeposits.bookingId, row.id));
  }
  const rules = await getAvailabilityRules();
  try {
    // one page per minute at most (a double tap gets the same page from Stripe)
    const { url } = await createDepositPage(row, d.amountCents, await noticeHoursFor(row, rules.limits.rescheduleNoticeHours), window.expiresAt, `deposit/${row.id}/link/${Math.floor(now.getTime() / 60_000)}`);
    log.info("deposit", "Deposit page opened from the family's link", { reference });
    return url;
  } catch (err) {
    log.error("deposit", "Stripe couldn't open the deposit page from the family's link", { reference, code: stripeCode(err) });
    throw new BookingError("server_error", t.error);
  }
}

/** The home saved on a booking: its address (a request books with "FL <zip>" only) and the gate / parking notes. */
async function linkHomeOf(row: Booking): Promise<LinkHome> {
  const [access] = await getDb().select({ notes: bookingAccess.notes }).from(bookingAccess).where(eq(bookingAccess.bookingId, row.id)).limit(1).catch(() => []);
  return { ...homeOf(row.locationAddress), accessNotes: access?.notes ?? "" };
}

/** The babies on a link: name and boy or girl, as saved (none = the booking has no baby rows). */
async function linkBabiesOf(bookingId: string): Promise<LinkBaby[]> {
  return ((await babiesFor([bookingId])).get(bookingId) ?? []).map((b) => ({ name: b.name ?? "", gender: b.gender ?? "" }));
}

/**
 * The family's home on their link, before the deposit (owner, Nov 16: no more texting the address): saved on the booking,
 * so /admin's Directions, the calendar event (made when the deposit is paid) and the emails all have it. The ZIP stays
 * the request's (the travel fee was priced on it). With it, optionally, each baby's name and boy or girl (owner, Nov 19).
 */
export async function saveLinkHome(reference: string, input: { street: string; city: string; accessNotes?: string }, babies?: { name?: string; gender?: GenderChoice }[]): Promise<{ home: LinkHome; babies: LinkBaby[] }> {
  const db = getDb();
  const [row] = await db.select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  if (!row || row.status !== "pending" || !isOwnerBooked(row)) throw new BookingError("invalid_request", (row?.locale === "es" ? es : en).bookingFlow.depositReturn.invalidTitle);
  const line = formatAddress({ street: input.street.trim(), city: input.city.trim(), zip: homeOf(row.locationAddress).zip });
  if (line !== row.locationAddress) await db.update(bookings).set({ locationAddress: line, updatedAt: new Date() }).where(eq(bookings.id, row.id));
  const notes = input.accessNotes?.trim() ?? "";
  await (notes
    ? db.insert(bookingAccess).values({ bookingId: row.id, notes }).onConflictDoUpdate({ target: bookingAccess.bookingId, set: { notes } })
    : db.delete(bookingAccess).where(eq(bookingAccess.bookingId, row.id)));
  const before = await linkBabiesOf(row.id);
  if (babies && before.length) {
    const names = before.map((b, i) => babies[i]?.name?.trim() ?? b.name);
    await Promise.all(names.map((name, position) => (name === before[position].name ? null : db.update(bookingBabies).set({ name: name || null }).where(and(eq(bookingBabies.bookingId, row.id), eq(bookingBabies.position, position))))));
    if (names[0] !== before[0].name) await db.update(bookings).set({ babyName: names[0] || null, updatedAt: new Date() }).where(eq(bookings.id, row.id));
    await saveBabyGenders(row.id, before.map((b) => b.gender), before.map((b, i) => babies[i]?.gender ?? b.gender));
  }
  return { home: { ...homeOf(line), accessNotes: notes }, babies: babies && before.length ? await linkBabiesOf(row.id) : before };
}

/** The family's backdrop picks on their link (a booking the owner made, still waiting on its deposit). */
export async function saveLinkBackdrops(reference: string, picks: string[]): Promise<string[]> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  if (!row || row.status !== "pending" || !isOwnerBooked(row)) throw new BookingError("invalid_request", (row?.locale === "es" ? es : en).bookingFlow.depositReturn.invalidTitle);
  const bundle = (await getCatalog()).find((b) => b.id === row.packageId);
  const allowed = bundle ? setupsOf([bundle.setups, ...bundle.features]) : 1;
  const kept = [...new Set(picks)].slice(0, allowed);
  await saveBackdrops(row.id, kept, "family");
  return kept;
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
    // Meta "Schedule" (paid from the family's link on our site; the request's match data when it came from one)
    scheduleBooking(current, "website", client);
    // a booking the owner made from a website request (/admin → Requests): that request is now booked
    await markRequestBooked({ bookingId: current.id });
    return "confirmed";
  } catch (err) {
    // the lease stays, so the next try (webhook retry, the family's page, the sweep) comes after LEASE_MS
    log.error("deposit", "Deposit paid, but the booking couldn't be confirmed yet (tried again in 2 minutes)", { reference: current.bookingReference, code: stripeCode(err) });
    return "failed";
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
  log.info("deposit", "Time released (deposit not paid)", { reference: row.bookingReference, familyNotified: opts.email });
  if (opts.email) {
    await sendAbandonedEmail(row);
    await sendUnpaidAlert(row);
  }
  return true;
}

/** The same family booked again after this booking (then nobody needs a "not confirmed" email or a follow-up). */
async function bookedAgain(row: Booking): Promise<boolean> {
  const [rebooked] = await getDb()
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(sql`lower(${bookings.email})`, row.email.toLowerCase()), ne(bookings.status, "cancelled"), gt(bookings.createdAt, row.createdAt)))
    .orderBy(desc(bookings.createdAt))
    .limit(1)
    .catch(() => []);
  return Boolean(rebooked);
}

/** "Your date isn't confirmed yet" + a link to pick a time again. Once per booking; skipped if they booked again since. */
async function sendAbandonedEmail(row: Booking): Promise<void> {
  const db = getDb();
  if (await bookedAgain(row)) return;
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
      { themeId, bookUrl: `${base()}${scheduleHref(row.packageId)}`, locale: row.locale },
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

/** The studio's "Deposit not paid" alert (one per expired hold): follow up from /admin or by text. Never throws. */
async function sendUnpaidAlert(row: Booking): Promise<void> {
  try {
    if (await bookedAgain(row)) return;
    const d = await depositOf(row.id);
    const mail = await internalDepositUnpaidEmail({
      reference: row.bookingReference,
      parentName: row.parentName,
      email: row.email,
      phone: row.phone,
      bundleName: row.packageName,
      date: row.sessionDate,
      start: localTime(row.sessionStart, row.timezone),
      amountCents: d?.amountCents ?? 0,
      leadsUrl: `${base()}/admin/leads`,
    });
    await sendEmail({
      scope: "resend.internal",
      from: emailConfig().internalFrom,
      to: emailConfig().notify,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: row.email,
      idempotencyKey: `deposit-unpaid/${row.bookingReference}/${d?.holdUntil?.getTime() ?? 0}`,
      reference: row.bookingReference,
    });
  } catch (err) {
    log.error("deposit", "'Deposit not paid' alert not sent", { reference: row.bookingReference, code: err instanceof EmailSendError ? err.code : "send_failed" });
  }
}

/** The family's own deposit page on our site (signed): it shows the Pay button while their time is held. */
export function depositPageUrl(row: Pick<Booking, "bookingReference" | "packageId" | "locale">): string | null {
  const path = depositReturnPath(row.bookingReference, row.packageId, row.locale);
  return path ? `${base()}${path}` : null;
}

/**
 * /admin "Email payment link" / "Copy link" for a booking's deposit. While its time is held, the link works until
 * the hold ends; once the 30 minutes ran out (the time was released), the same time is held again for 30 minutes if
 * it's still free. With `email`, the family gets the "Finish booking" email. Returns the link and the hold's end.
 */
export async function ownerDepositLink(row: Booking, opts: { email: boolean }, now = new Date()): Promise<{ url: string; holdUntil: Date }> {
  let d = await depositOf(row.id);
  if (!d) throw new BookingError("invalid_request", "This booking was made without a deposit.");
  if (d.status === "paid" || d.status === "refunded") throw new BookingError("invalid_request", "This deposit is already paid.");
  if (!isStripeConfigured()) throw new BookingError("server_error", "Stripe isn't connected (STRIPE_SECRET_KEY is missing in Vercel).");
  let held = row;
  if (row.status === "pending" && d.status === "pending") {
    // still held: its Stripe page must still be open (it isn't if Stripe never opened it, or it just ran out). A
    // booking the owner made has no page until the family presses Pay: its link works for the whole hold.
    const ownerHeld = isOwnerBooked(row) && d.holdUntil && d.holdUntil.getTime() > now.getTime() + GRACE_MS;
    if (!ownerHeld && !(await reopenDeposit(row).catch(() => null))) {
      const r = await settleWithStripe(row, d, { email: false, closeOpen: true }).catch(() => "unknown" as const);
      if (r === "paid") throw new BookingError("invalid_request", "Stripe says this deposit was just paid: the booking is being confirmed.");
      if (r !== "released") throw new BookingError("server_error", "Couldn't check the payment page with Stripe. Please try again.");
      held = await holdAgain({ ...row, status: "cancelled" }, d, now);
    }
  } else if (row.status === "cancelled" && d.status === "expired") {
    held = await holdAgain(row, d, now);
  } else {
    throw new BookingError("invalid_request", "There's no deposit waiting for this booking.");
  }
  d = (await depositOf(row.id)) ?? d;
  const url = depositPageUrl(held);
  if (!url || !d.holdUntil) throw new BookingError("server_error", "Payment links need ADMIN_SESSION_SECRET.");
  if (opts.email) await sendDepositLinkEmail(held, d, url);
  return { url, holdUntil: d.holdUntil };
}

/** Holds a released time again for 30 minutes (if it's still free) and opens a new Stripe page for the deposit. */
async function holdAgain(row: Booking, d: BookingDeposit, now: Date): Promise<Booking> {
  if (row.sessionStart.getTime() <= now.getTime()) throw new BookingError("invalid_request", "This session time has already passed.");
  const tz = row.timezone || bookingRules.timeZone;
  const minutes = Math.round((row.sessionEnd.getTime() - row.sessionStart.getTime()) / 60_000);
  const rules = await getAvailabilityRules();
  // free in the owner's hours, clear of other bookings, Outlook events and blocks (the minimum notice is the owner's call)
  let busy;
  try {
    busy = await busyExcluding(row, row.sessionDate, row.sessionDate);
  } catch {
    throw new BookingError("calendar_unavailable", "Couldn't check the calendar just now. Please try again in a minute.");
  }
  if (!slotsForDay(row.sessionDate, minutes, busy, ownerRulesOf(rules), now).some((s) => s.start === localTime(row.sessionStart, tz))) {
    throw new BookingError("slot_unavailable", TAKEN_AGAIN);
  }
  const db = getDb();
  const holdUntil = new Date(now.getTime() + (DEPOSIT_HOLD_MINUTES + 1) * 60_000);
  let held: Booking | undefined;
  try {
    // listing session_start re-runs the trigger, so the block uses today's buffer
    [held] = await db
      .update(bookings)
      .set({ status: "pending", cancellationReason: null, cancelledAt: null, cancelledBy: null, sessionStart: row.sessionStart, updatedAt: now })
      .where(and(eq(bookings.id, row.id), eq(bookings.status, "cancelled")))
      .returning();
  } catch (err) {
    if (isOverlapViolation(err) || isUniqueViolation(err)) throw new BookingError("slot_unavailable", TAKEN_AGAIN);
    throw err;
  }
  if (!held) throw new BookingError("invalid_request", "This lead changed meanwhile. Refresh the page and try again.");
  await db.update(bookingDeposits).set({ status: "pending", holdUntil, stripeSessionId: null, confirmingAt: null, updatedAt: now }).where(eq(bookingDeposits.bookingId, row.id));
  await reclaimCode(held);
  try {
    await createDepositPage(held, d.amountCents, await noticeHoursFor(held, rules.limits.rescheduleNoticeHours), holdUntil, `deposit/${row.id}/${holdUntil.getTime()}`);
  } catch (err) {
    log.error("deposit", "Stripe couldn't open the page to hold the time again", { reference: row.bookingReference, code: stripeCode(err) });
    await releaseHold(held, { email: false, why: EXPIRED_REASON }).catch(() => undefined);
    throw new BookingError("server_error", "Stripe couldn't open a payment page just now, so the time wasn't held. Please try again.");
  }
  log.info("deposit", "Time held again from /admin", { reference: row.bookingReference });
  return held;
}

/** A discount code given back when the time was released counts again (best effort: the booked price stands). */
async function reclaimCode(row: Booking): Promise<void> {
  if (!row.discountCode) return;
  try {
    const [code] = await getDb().select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, row.discountCode.trim().toUpperCase())).limit(1);
    if (!code) return;
    const usage = await claimCode(code.id, row.email);
    await attachUsage(usage.usageId, row.id);
  } catch {
    log.info("deposit", "Discount code use not counted again (code maxed or gone); the booked price stands", { reference: row.bookingReference });
  }
}

const ownerBookedDetails = (row: Booking, d: BookingDeposit): OwnerBookedDetails => ({
  parentName: row.parentName,
  bundleName: row.packageName,
  date: row.sessionDate,
  start: localTime(row.sessionStart, row.timezone),
  untilDate: todayInZone(row.timezone, d.holdUntil!),
  untilTime: localTime(d.holdUntil!, row.timezone),
  amountCents: d.amountCents,
});

/**
 * Right after the owner books for a family (/admin → Quotes / Booking): their link, a text to copy, and (with `email`)
 * the "We saved your session" email. An email problem never undoes the booking: `emailError` says why, the link works.
 */
export async function ownerBookingLink(reference: string, opts: { email: boolean }): Promise<{ url: string; holdUntil: string; sms: string; emailed: boolean; emailError?: string }> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  const d = row ? await depositOf(row.id) : null;
  const url = row ? depositPageUrl(row) : null;
  if (!row || !d?.holdUntil || !url) throw new BookingError("server_error", "The booking was saved, but its link couldn't be made. Open it in Leads → Not paid.");
  const sms = ownerBookedSms(ownerBookedDetails(row, d), url, row.locale === "es" ? "es" : "en");
  if (!opts.email) return { url, holdUntil: d.holdUntil.toISOString(), sms, emailed: false };
  try {
    await sendDepositLinkEmail(row, d, url);
    return { url, holdUntil: d.holdUntil.toISOString(), sms, emailed: true };
  } catch (err) {
    return { url, holdUntil: d.holdUntil.toISOString(), sms, emailed: false, emailError: (err as Error).message };
  }
}

/** The family's "Finish booking: pay the deposit" email (from /admin). Throws a friendly error when it can't be sent. */
async function sendDepositLinkEmail(row: Booking, d: BookingDeposit, url: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const [claimed] = await db
    .insert(bookingEmails)
    .values({ bookingId: row.id, kind: "deposit_link", sessionStart: row.sessionStart })
    .onConflictDoUpdate({ target: [bookingEmails.bookingId, bookingEmails.kind, bookingEmails.sessionStart], set: { status: "sending", attempts: sql`${bookingEmails.attempts} + 1`, error: null, updatedAt: now } })
    .returning({ id: bookingEmails.id, attempts: bookingEmails.attempts });
  try {
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    // a booking the owner made: "We saved your session" (backdrops + deposit, the hold's day and time)
    const mail = isOwnerBooked(row)
      ? await ownerBookedEmail(ownerBookedDetails(row, d), { themeId, url, locale: row.locale })
      : await depositLinkEmail(
          { parentName: row.parentName, bundleName: row.packageName, date: row.sessionDate, start: localTime(row.sessionStart, row.timezone), until: localTime(d.holdUntil!, row.timezone), amountCents: d.amountCents },
          { themeId, payUrl: url, locale: row.locale },
        );
    const { id: resendId } = await sendEmail({
      scope: "resend.deposit_link",
      to: row.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `deposit-link/${row.bookingReference}/${claimed.attempts}`,
      reference: row.bookingReference,
    });
    await db.update(bookingEmails).set({ status: "sent", resendId, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, claimed.id));
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("deposit", "Deposit link email not sent", { reference: row.bookingReference, code });
    await db.update(bookingEmails).set({ status: "failed", error: code, updatedAt: new Date() }).where(eq(bookingEmails.id, claimed.id)).catch(() => undefined);
    throw new BookingError("server_error", `The email wasn't sent (${code}). The time is still held: copy the link and text it instead, or try again.`);
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
  if (row.status === "confirmed" || row.status === "rescheduled") return { state: "confirmed", booking: await resultOf(row) };
  if (row.status === "pending" && deposit?.status === "paid") return { state: "confirming" };
  if (row.status === "pending") {
    const waiting = { state: "waiting" as const, amountCents: deposit?.amountCents ?? 0, holdUntil: deposit?.holdUntil?.toISOString() ?? null, date: row.sessionDate, start, end: localTime(row.sessionEnd, row.timezone), bundleName: row.packageName, payUrl };
    if (!isOwnerBooked(row)) return waiting;
    // booked by the owner: the family adds their home address and picks their backdrops here, then pays
    const [bundle, saved, home, babies] = await Promise.all([getCatalog().then((all) => all.find((b) => b.id === row!.packageId)).catch(() => undefined), backdropsFor([row.id]).catch(() => []), linkHomeOf(row), linkBabiesOf(row.id).catch(() => [])]);
    return { ...waiting, ownerBooked: true, backdrops: { allowed: bundle ? setupsOf([bundle.setups, ...bundle.features]) : 1, picks: saved[0]?.picks ?? [] }, home, babies };
  }
  if (deposit?.status === "expired") return { state: "expired", date: row.sessionDate, start, bundleName: row.packageName };
  return { state: "invalid" };
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
    pricing: details.pricing,
    travel: { feeCents: row.travelFeeCents, miles: row.travelMiles },
    rescheduleNoticeHours: await noticeHoursFor(row, rules.limits.rescheduleNoticeHours),
    deposit: details.deposit,
    request: {
      bundleId: row.packageId,
      babies: details.babies,
      family: details.family,
      slot: { id: `${details.date}T${details.start}`, date: details.date, start: details.start, end: details.end, label: formatTimeLabel(details.start) },
      contact: details.contact,
      address: details.address,
      inspirationPhotoId: row.inspirationPhotoId ?? undefined,
      backdrops: details.backdrops,
    },
  };
}
