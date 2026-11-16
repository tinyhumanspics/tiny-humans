import "server-only";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import { createHmac } from "crypto";
import { and, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { bookingRules, scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import { hashCancelToken, looksLikeCancelToken } from "@/lib/booking/cancel-token";
import { formatLongDate } from "@/lib/booking/dates";
import { BookingError } from "@/lib/booking/errors";
import { extraBabyLine } from "@/lib/booking/extra-babies";
import { generateBookingReference } from "@/lib/booking/reference";
import { todayInZone } from "@/lib/booking/timezone";
import { getDb, isDatabaseConfigured, isUniqueViolation } from "@/lib/db/client";
import { bookingDeposits, bookings, discountCodeUsage, discountCodes, dueDateReservations, dueDepositReminders, dueReservationExtras, type DueDateReservation } from "@/lib/db/schema";
import { getDepositSettings } from "@/lib/deposit/server";
import { depositCentsFor } from "@/lib/deposit/types";
import { dueDepositReminderEmail, dueReservedEmail, internalDueReservedEmail } from "@/lib/email";
import { fill } from "@/lib/email/messages";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { duePayPath, verifyDuePay } from "@/lib/payments/link";
import { createCheckoutSession, createRefund, expireCheckoutSession, getCheckoutSession, isStripeConfigured, StripeError, type CheckoutSession } from "@/lib/payments/stripe";
import { codeDiscountCents, computeQuote, formatMoney, type CodeTerms } from "@/lib/pricing/engine";
import { claimCode, getCatalog } from "@/lib/pricing/server";
import type { Bundle } from "@/lib/pricing/types";
import { getSiteSettings } from "@/lib/settings/server";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { DueReservationRow, DueSummary } from "./types";
import type { NotPaidDue } from "@/lib/leads/types";
import { markRequestBooked } from "@/lib/requests/store";
import { scheduleReservation } from "@/lib/tracking/schedule";

const base = () => site.url.replace(/\/$/, "");
const missingTable = (err: unknown) => (err as { cause?: { code?: string } })?.cause?.code === "42P01" || /does not exist/.test(String((err as Error)?.message ?? ""));
const safe = (err: unknown) => (err instanceof Error ? err : new Error("query failed"));
/** A crashed "book their session" request leaves the reservation claimed; after this long it can be booked again. */
const CLAIM_MS = 5 * 60_000;

/**
 * The family's schedule link token: derived from a server secret and the reservation id (like a deposit booking's
 * manage token), so every email and /admin can rebuild the same link. Only its hash is stored.
 */
export function dueTokenFor(id: string): { token: string; hash: string } | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const token = createHmac("sha256", secret).update(`due-schedule:v1:${id}`).digest("base64url");
  return { token, hash: hashCancelToken(token) };
}

/** /book for their bundle, with the schedule token: the booking form fills itself in and asks for no new deposit. */
export function scheduleUrlFor(row: Pick<DueDateReservation, "id" | "packageId" | "locale">): string | null {
  const t = dueTokenFor(row.id);
  return t ? `${base()}${scheduleHref(row.packageId, null, row.locale)}&due=${t.token}` : null;
}

/** The bundle as it was priced for this family the day they reserved (regular price + the offer they got). */
export function keptPriceBundle(row: Pick<DueDateReservation, "regularPriceCents" | "bundlePriceCents" | "offerLabel">, bundle: Bundle): Bundle {
  const offer = row.bundlePriceCents < row.regularPriceCents ? { enabled: true, price: row.bundlePriceCents / 100, label: row.offerLabel, endsOn: null } : null;
  return { ...bundle, price: row.regularPriceCents / 100, offer };
}

function reference(): string {
  return generateBookingReference().replace(/^TH-/, "TH-D-");
}

/**
 * A "Not born yet" request the owner confirmed (/admin → Requests, brief 02): a reservation like the form's, priced
 * today, with the address still to come (the family adds it when their session is booked). With deposits on, the
 * family gets the deposit email: its button opens their reservation page, which opens a payment page any time (no
 * page is opened now). That email counts as the reminder, so no automatic one follows. Same request again = the same
 * reservation.
 */
export async function reserveDueForRequest(r: { requestId: string; bundleId: string; babyCount: number; dueDate: string; firstName: string; email: string; phone: string; zip: string; locale: "en" | "es" }): Promise<{ row: DueDateReservation; url: string | null; emailed: boolean; emailError?: string }> {
  const db = getDb();
  const [existing] = await db.select().from(dueDateReservations).where(eq(dueDateReservations.requestId, `request-${r.requestId}`)).limit(1);
  if (existing) return { row: existing, url: payPageFor(existing), emailed: false };
  const bundle = (await getCatalog()).find((b) => b.id === r.bundleId && b.active !== false);
  if (!bundle) throw new BookingError("invalid_request", "That bundle is turned off now. Turn it back on in Pricing, or use Other time.");
  if (r.babyCount > 1 && !extraBabyLine(bundle, r.babyCount)) throw new BookingError("invalid_request", "That bundle doesn't offer this baby count anymore.");
  const travel = travelQuote(r.zip, await getTravelSettings());
  const travelCents = travel.status === "fee" ? travel.feeCents : 0;
  const pricing = computeQuote(bundle, todayInZone(bookingRules.timeZone));
  const depositCents = depositCentsFor(pricing.finalCents + travelCents, bundle.id, await getDepositSettings());
  if (depositCents > 0 && (!isStripeConfigured() || !duePayPath("TH-D-CHECK"))) {
    throw new BookingError("not_configured", "Deposits are on, but Stripe (STRIPE_SECRET_KEY) or ADMIN_SESSION_SECRET isn't set in Vercel, so the deposit link can't work. Nothing was saved.");
  }
  const id = crypto.randomUUID();
  const token = dueTokenFor(id);
  if (!token) throw new BookingError("not_configured", "Reservations need ADMIN_SESSION_SECRET in Vercel. Nothing was saved.");
  let row: DueDateReservation | undefined;
  for (let attempt = 0; attempt < 4 && !row; attempt++) {
    try {
      [row] = await db
        .insert(dueDateReservations)
        .values({
          id,
          reference: reference(),
          requestId: `request-${r.requestId}`,
          packageId: bundle.id,
          packageName: bundle.name,
          regularPriceCents: pricing.regularCents,
          bundlePriceCents: pricing.finalCents,
          offerLabel: pricing.offerLabel,
          babyCount: r.babyCount,
          dueDate: r.dueDate,
          parentName: r.firstName,
          email: r.email,
          phone: r.phone,
          locale: r.locale,
          street: "",
          city: "",
          zip: r.zip.slice(0, 5),
          travelFeeCents: travel.status === "off" ? null : travelCents,
          travelMiles: travel.miles,
          status: depositCents > 0 ? "pending" : "reserved",
          depositCents,
          depositStatus: depositCents > 0 ? "pending" : "none",
          scheduleTokenHash: token.hash,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err, "reference")) continue;
      log.error("due.db", "Reservation from a request not saved", { error: safe(err) });
      throw new BookingError("server_error", "The reservation couldn't be saved. Please try again.");
    }
  }
  if (!row) throw new BookingError("server_error", "The reservation couldn't be saved. Please try again.");
  if (depositCents === 0) {
    await sendDueEmails(row);
    return { row, url: null, emailed: true };
  }
  const url = payPageFor(row)!;
  try {
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    const mail = await dueDepositReminderEmail(
      { parentName: row.parentName, bundleName: row.packageName, dueDate: row.dueDate, amountCents: row.depositCents, bundlePriceCents: row.bundlePriceCents, offerLabel: row.bundlePriceCents < row.regularPriceCents ? row.offerLabel : null },
      { themeId, payUrl: url, locale: row.locale, auto: true },
    );
    await sendEmail({ scope: "resend.due_deposit_reminder", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `due-request/${row.reference}`, reference: row.reference });
    await db.insert(dueDepositReminders).values({ reservationId: row.id }).onConflictDoNothing().catch(() => undefined);
    return { row, url, emailed: true };
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("due", "Deposit email for a confirmed request not sent", { reference: row.reference, code });
    return { row, url, emailed: false, emailError: `The email wasn't sent (${code}): text them the link instead.` };
  }
}

/** The family's deposit link (/pay?d=…&k=…, signed): it opens a payment page while the deposit is missing. */
function payPageFor(row: Pick<DueDateReservation, "reference" | "locale">): string | null {
  const back = duePayPath(row.reference, row.locale);
  return back ? `${base()}${back}` : null;
}

/**
 * The Stripe page for the deposit. Nothing is held meanwhile, so the family's own page closes after an hour (owner, Nov
 * 11: then the automatic "Finish reserving your spot" email goes out); the owner's reminder link stays open a day.
 * Null when Stripe can't.
 */
async function openDuePage(row: DueDateReservation, idempotencyKey = `due-deposit/${row.id}`, hours = 1): Promise<string | null> {
  const back = duePayPath(row.reference, row.locale);
  if (!back || !isStripeConfigured()) {
    log.error("due", "Deposit is on, but Stripe or ADMIN_SESSION_SECRET is missing: reserved without it", { reference: row.reference });
    return null;
  }
  const messages = row.locale === "es" ? es : en;
  try {
    const session = await createCheckoutSession({
      amountCents: row.depositCents,
      productName: fill(messages.dueDate.stripe.product, { bundle: row.packageName }),
      description: fill(messages.dueDate.stripe.description, { date: formatLongDate(row.dueDate, row.locale) }),
      customerEmail: row.email,
      reference: row.reference,
      bookingId: row.id,
      // back from Stripe: "Your spot is reserved", or "No payment was made" (their link works again any time)
      successUrl: `${base()}${localePath("/pay/status", row.locale)}?s=reserved`,
      cancelUrl: `${base()}${localePath("/pay/status", row.locale)}?s=cancelled`,
      idempotencyKey,
      kind: "due_deposit",
      expiresAt: Math.floor(Date.now() / 1000) + Math.round(hours * 3600),
      submitMessage: messages.dueDate.stripe.message,
    });
    if (!session.url) throw new StripeError("no_url", "Stripe returned no payment page URL");
    await getDb().update(dueDateReservations).set({ stripeSessionId: session.id, updatedAt: new Date() }).where(eq(dueDateReservations.id, row.id));
    return session.url;
  } catch (err) {
    log.error("due", "Stripe couldn't open the deposit page", { reference: row.reference, code: err instanceof StripeError ? err.code : undefined });
    return null;
  }
}

/** Stripe says the deposit is paid (webhook or the page they come back to): reserved, and the emails go out once. */
export async function dueDepositPaid(id: string, session: Pick<CheckoutSession, "id" | "payment_intent" | "payment_status">): Promise<void> {
  if (session.payment_status !== "paid") return;
  const [row] = await getDb()
    .update(dueDateReservations)
    .set({ status: "reserved", depositStatus: "paid", stripeSessionId: session.id, stripePaymentIntent: session.payment_intent, depositPaidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), or(inArray(dueDateReservations.status, ["pending", "expired"]), and(eq(dueDateReservations.status, "reserved"), eq(dueDateReservations.depositStatus, "unpaid")))))
    .returning();
  if (!row) return;
  log.info("due", "Due-date deposit paid", { reference: row.reference });
  await claimDueCode(row);
  await sendDueEmails(row);
  // a reservation the owner made from a website request (/admin → Requests): that request is now booked
  await markRequestBooked({ dueId: row.id });
  // Meta "Schedule" for the reservation (its session, booked later, isn't counted again)
  scheduleReservation(row);
}

/** The deposit page closed unpaid: the reservation ends (the family can reserve again; nothing was held). */
export async function dueDepositExpired(id: string): Promise<void> {
  const [row] = await getDb()
    .update(dueDateReservations)
    .set({ status: "expired", depositStatus: "expired", updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), eq(dueDateReservations.status, "pending")))
    .returning();
  if (row) await autoRemindDue(row);
}

/** The reservation behind a schedule link (any status; the caller decides). */
export async function dueByToken(token: string): Promise<DueDateReservation | null> {
  if (!looksLikeCancelToken(token) || !isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb().select().from(dueDateReservations).where(eq(dueDateReservations.scheduleTokenHash, hashCancelToken(token))).limit(1);
    return row ?? null;
  } catch (err) {
    if (!missingTable(err)) log.error("due.db", "Reservation lookup failed", { error: safe(err) });
    return null;
  }
}

export async function dueById(id: string): Promise<DueDateReservation | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(dueDateReservations).where(eq(dueDateReservations.id, id)).limit(1);
  return row ?? null;
}

/** What the booking form shows and fills in for a schedule link. */
export function dueSummaryOf(row: DueDateReservation, extras?: DueExtras | null): DueSummary {
  return {
    backdrops: extras?.backdrops ?? [],
    discountCode: extras?.code?.code ?? null,
    reference: row.reference,
    bundleId: row.packageId,
    bundleName: row.packageName,
    dueDate: row.dueDate,
    babyCount: row.babyCount,
    bundlePriceCents: row.bundlePriceCents,
    regularPriceCents: row.regularPriceCents,
    offerLabel: row.offerLabel,
    depositPaidCents: row.depositStatus === "paid" ? row.depositCents : 0,
    contact: { parentName: row.parentName, email: row.email, phone: row.phone, street: row.street, unit: row.unit ?? "", city: row.city, zip: row.zip },
  };
}

/** One booking per reservation: claims it before the booking is saved (a crashed claim frees itself after 5 minutes). */
export async function claimDue(id: string): Promise<boolean> {
  const stale = new Date(Date.now() - CLAIM_MS);
  const [row] = await getDb()
    .update(dueDateReservations)
    .set({ status: "scheduling", updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), or(eq(dueDateReservations.status, "reserved"), and(eq(dueDateReservations.status, "scheduling"), lt(dueDateReservations.updatedAt, stale)))))
    .returning({ id: dueDateReservations.id });
  return Boolean(row);
}

export async function releaseDue(id: string): Promise<void> {
  await getDb()
    .update(dueDateReservations)
    .set({ status: "reserved", updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), eq(dueDateReservations.status, "scheduling")))
    .catch((err) => log.error("due.db", "Reservation not released after a failed booking", { error: safe(err) }));
}

/**
 * The booking made from a reservation is saved: the deposit paid for the reservation becomes the booking's paid
 * deposit (so the balance, Leads and refunds count it), before the booking is confirmed.
 */
export async function carryDueDeposit(row: DueDateReservation, bookingId: string): Promise<void> {
  if (row.depositStatus !== "paid" || !row.depositCents) return;
  await getDb()
    .insert(bookingDeposits)
    .values({ bookingId, amountCents: row.depositCents, status: "paid", stripeSessionId: row.stripeSessionId, stripePaymentIntent: row.stripePaymentIntent, paidAt: row.depositPaidAt ?? new Date() })
    .onConflictDoNothing();
}

export async function finishDue(id: string, bookingId: string): Promise<void> {
  await getDb()
    .update(dueDateReservations)
    .set({ status: "scheduled", bookingId, updatedAt: new Date() })
    .where(eq(dueDateReservations.id, id))
    .catch((err) => log.error("due.db", "Reservation not marked as booked (the booking itself is fine)", { error: safe(err) }));
}

/** "Your spot is reserved" (family, with the schedule link) + the studio alert. Never throws. */
async function sendDueEmails(row: DueDateReservation): Promise<void> {
  const scheduleUrl = scheduleUrlFor(row);
  if (!scheduleUrl) return;
  const extras = await dueExtrasOf(row.id);
  const code = extras?.code ? { code: extras.code.code, offCents: codeDiscountCents(row.regularPriceCents, extras.code) } : null;
  const themeId = await getSiteSettings()
    .then((s) => s.themeId)
    .catch(() => "default");
  const details = {
    reference: row.reference,
    parentName: row.parentName,
    bundleName: row.packageName,
    dueDate: row.dueDate,
    bundlePriceCents: row.bundlePriceCents,
    regularPriceCents: row.regularPriceCents,
    offerLabel: row.offerLabel,
    depositPaidCents: row.depositStatus === "paid" ? row.depositCents : 0,
    babyCount: row.babyCount,
    code,
  };
  try {
    const mail = await dueReservedEmail(details, { themeId, scheduleUrl, locale: row.locale });
    await sendEmail({ scope: "resend.due_reserved", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `due-reserved/${row.reference}`, reference: row.reference });
  } catch (err) {
    log.error("due", "'Spot reserved' email not sent", { reference: row.reference, code: err instanceof EmailSendError ? err.code : "send_failed" });
  }
  try {
    const mail = await internalDueReservedEmail({ ...details, email: row.email, phone: row.phone, address: [row.street, row.unit, row.city, row.zip].filter(Boolean).join(", "), notes: row.notes, depositStatus: row.depositStatus, depositCents: row.depositCents, travelFeeCents: row.travelFeeCents, travelMiles: row.travelMiles, scheduleUrl, leadsUrl: `${base()}/admin/leads?view=due`, backdrops: extras?.backdrops });
    await sendEmail({ scope: "resend.internal", from: emailConfig().internalFrom, to: emailConfig().notify, subject: mail.subject, html: mail.html, text: mail.text, replyTo: row.email, idempotencyKey: `due-reserved-studio/${row.reference}`, reference: row.reference });
  } catch (err) {
    log.error("due", "Studio 'due-date reservation' email not sent", { reference: row.reference, code: err instanceof EmailSendError ? err.code : "send_failed" });
  }
}

/* ---------------- owner area ---------------- */

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** /admin → Leads → Due dates: every reservation, soonest due date first (finished ones last). Null = table missing. */
export async function listDueReservations(): Promise<DueReservationRow[] | null> {
  if (!isDatabaseConfigured()) return [];
  try {
    const db = getDb();
    const rows = await db.select().from(dueDateReservations).orderBy(desc(dueDateReservations.createdAt)).limit(300);
    const ids = rows.map((r) => r.bookingId).filter((x): x is string => Boolean(x));
    const booked = ids.length ? await db.select({ id: bookings.id, reference: bookings.bookingReference, date: bookings.sessionDate, start: bookings.sessionStart, tz: bookings.timezone }).from(bookings).where(inArray(bookings.id, ids)) : [];
    const extras = await dueExtrasFor(rows.map((r) => r.id));
    const open = (s: string) => (s === "reserved" || s === "scheduling" || s === "pending" ? 0 : 1);
    return rows
      .map((r) => {
        const b = booked.find((x) => x.id === r.bookingId);
        return {
          id: r.id,
          reference: r.reference,
          status: r.status as DueReservationRow["status"],
          depositStatus: r.depositStatus as DueReservationRow["depositStatus"],
          depositCents: r.depositCents,
          bundleId: r.packageId,
          bundleName: r.packageName,
          bundlePriceCents: r.bundlePriceCents,
          regularPriceCents: r.regularPriceCents,
          offerLabel: r.offerLabel,
          babyCount: r.babyCount,
          dueDate: r.dueDate,
          parentName: r.parentName,
          email: r.email,
          phone: r.phone,
          locale: r.locale,
          address: [r.street, r.unit, r.city, r.zip].filter(Boolean).join(", "),
          zip: r.zip,
          notes: r.notes,
          travelFeeCents: r.travelFeeCents,
          travelMiles: r.travelMiles,
          createdAt: r.createdAt.toISOString(),
          booking: b ? { reference: b.reference, date: b.date, start: localTime(b.start, b.tz) } : null,
          scheduleUrl: r.status === "reserved" ? scheduleUrlFor(r) : null,
          backdrops: extras.get(r.id)?.backdrops ?? [],
          discount: (() => {
            const c = extras.get(r.id)?.code;
            return c ? { code: c.code, offCents: codeDiscountCents(r.regularPriceCents, c) } : null;
          })(),
        };
      })
      .sort((a, b) => open(a.status) - open(b.status) || (open(a.status) === 0 ? a.dueDate.localeCompare(b.dueDate) : b.createdAt.localeCompare(a.createdAt)));
  } catch (err) {
    if (missingTable(err)) return null;
    log.error("due.db", "Reservations not loaded", { error: safe(err) });
    throw err;
  }
}

/** /admin: cancel a reservation that has no booking yet, refunding its deposit on Stripe when asked. */
export async function cancelDueReservation(id: string, refund: boolean): Promise<{ refunded: boolean; refundError?: string }> {
  const db = getDb();
  const [row] = await db
    .update(dueDateReservations)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), inArray(dueDateReservations.status, ["pending", "reserved", "expired"])))
    .returning();
  if (!row) throw new BookingError("invalid_request", "This reservation can't be cancelled (already booked or cancelled).");
  await releaseDueCode(row.id);
  if (!refund || row.depositStatus !== "paid") return { refunded: false };
  if (!row.stripePaymentIntent) return { refunded: false, refundError: "No Stripe payment found: refund it in Stripe." };
  try {
    const r = await createRefund({ paymentIntent: row.stripePaymentIntent, reference: row.reference, idempotencyKey: `due-refund/${row.id}` });
    await db.update(dueDateReservations).set({ depositStatus: "refunded", refundId: r.id, updatedAt: new Date() }).where(eq(dueDateReservations.id, row.id));
    return { refunded: true };
  } catch (err) {
    log.error("due", "Deposit refund failed", { reference: row.reference, code: err instanceof StripeError ? err.code : undefined });
    return { refunded: false, refundError: `Stripe didn't refund the ${formatMoney(row.depositCents)}: refund it in Stripe.` };
  }
}

/** A reservation that still needs its deposit: at the Stripe page, the page ran out, or reserved while Stripe was down. */
const missingDeposit = (r: Pick<DueDateReservation, "status" | "depositStatus" | "depositCents">) =>
  r.depositCents > 0 &&
  ((r.status === "pending" && r.depositStatus === "pending") || (r.status === "expired" && r.depositStatus === "expired") || (r.status === "reserved" && r.depositStatus === "unpaid"));

/** Reminders already emailed (best effort: no table before migration 0031 = none known). */
async function remindersFor(ids: string[]): Promise<Map<string, { count: number; lastAt: string }>> {
  const out = new Map<string, { count: number; lastAt: string }>();
  if (!ids.length) return out;
  try {
    const rows = await getDb().select().from(dueDepositReminders).where(inArray(dueDepositReminders.reservationId, ids));
    for (const r of rows) out.set(r.reservationId, { count: r.count, lastAt: r.lastSentAt.toISOString() });
  } catch (err) {
    if (!missingTable(err)) log.error("due.db", "Deposit reminders not loaded", { error: safe(err) });
  }
  return out;
}

/**
 * Leads → Not paid (owner, Nov 11): "Not born yet" families who haven't paid the deposit, newest first. A family who
 * reserved again (or booked a session) since then has moved on and isn't listed. Best effort: [] without the table.
 */
export async function notPaidDue(): Promise<NotPaidDue[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const db = getDb();
    const rows = (
      await db
        .select()
        .from(dueDateReservations)
        .where(and(gt(dueDateReservations.depositCents, 0), inArray(dueDateReservations.depositStatus, ["pending", "expired", "unpaid"])))
        .orderBy(desc(dueDateReservations.createdAt))
        .limit(200)
    ).filter(missingDeposit);
    if (!rows.length) return [];
    const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()))];
    const [laterDue, laterBookings] = await Promise.all([
      db
        .select({ email: dueDateReservations.email, createdAt: dueDateReservations.createdAt })
        .from(dueDateReservations)
        .where(and(inArray(sql`lower(${dueDateReservations.email})`, emails), inArray(dueDateReservations.status, ["reserved", "scheduling", "scheduled"]), ne(dueDateReservations.depositStatus, "unpaid"))),
      db.select({ email: bookings.email, createdAt: bookings.createdAt }).from(bookings).where(and(inArray(sql`lower(${bookings.email})`, emails), ne(bookings.status, "cancelled"))),
    ]);
    const movedOn = (r: DueDateReservation) =>
      [...laterDue, ...laterBookings].some((x) => x.email.trim().toLowerCase() === r.email.trim().toLowerCase() && x.createdAt.getTime() > r.createdAt.getTime());
    const open = rows.filter((r) => !movedOn(r));
    const sent = await remindersFor(open.map((r) => r.id));
    return open.map((r) => ({
      id: r.id,
      reference: r.reference,
      parentName: r.parentName,
      email: r.email,
      phone: r.phone,
      bundleName: r.packageName,
      dueDate: r.dueDate,
      depositCents: r.depositCents,
      why: r.depositStatus as NotPaidDue["why"],
      createdAt: r.createdAt.toISOString(),
      reminders: sent.get(r.id) ?? null,
    }));
  } catch (err) {
    if (missingTable(err)) return [];
    log.error("due.db", "Unpaid reservations not loaded", { error: safe(err) });
    return [];
  }
}

/**
 * /admin → Leads → Not paid → "Email deposit reminder" (owner, Nov 11): their details stay saved; the email links to
 * their own reservation page, which opens a Stripe page for the deposit (open a day; nothing is held meanwhile). An
 * expired reservation is waiting on its deposit again. The reminder is counted (best effort).
 */
export async function remindDueDeposit(id: string): Promise<{ counted: boolean }> {
  const db = getDb();
  let [row] = await db.select().from(dueDateReservations).where(eq(dueDateReservations.id, id)).limit(1);
  if (!row) throw new BookingError("invalid_request", "That reservation isn't here anymore. Refresh the page.");
  if (!missingDeposit(row)) throw new BookingError("invalid_request", "This reservation's deposit isn't missing anymore. Refresh the page.");
  if (!isStripeConfigured()) throw new BookingError("server_error", "Stripe isn't connected (STRIPE_SECRET_KEY is missing in Vercel).");
  const back = duePayPath(row.reference, row.locale);
  if (!back) throw new BookingError("server_error", "Payment links need ADMIN_SESSION_SECRET.");
  row = (await ensureDuePayPage(row, 23)).row;
  const themeId = await getSiteSettings()
    .then((s) => s.themeId)
    .catch(() => "default");
  const mail = await dueDepositReminderEmail(
    { parentName: row.parentName, bundleName: row.packageName, dueDate: row.dueDate, amountCents: row.depositCents, bundlePriceCents: row.bundlePriceCents, offerLabel: row.bundlePriceCents < row.regularPriceCents ? row.offerLabel : null },
    { themeId, payUrl: `${base()}${back}`, locale: row.locale },
  );
  try {
    await sendEmail({ scope: "resend.due_deposit_reminder", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `due-deposit-reminder/${row.reference}/${Date.now()}`, reference: row.reference });
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("due", "Deposit reminder not sent", { reference: row.reference, code });
    throw new BookingError("server_error", `The email wasn't sent (${code}). Please try again.`);
  }
  log.info("due", "Deposit reminder emailed", { reference: row.reference });
  // counted best effort: before migration 0031 the email still goes out, and Leads says the count isn't kept
  return db
    .insert(dueDepositReminders)
    .values({ reservationId: row.id })
    .onConflictDoUpdate({ target: dueDepositReminders.reservationId, set: { count: sql`${dueDepositReminders.count} + 1`, lastSentAt: new Date() } })
    .then(() => ({ counted: true }))
    .catch((err) => {
      if (!missingTable(err)) log.error("due.db", "Deposit reminder not counted", { reference: row.reference, error: safe(err) });
      return { counted: false };
    });
}

/** What a reservation chose (owner, Nov 11): backdrops and a discount code with its kept terms. */
export interface DueExtras {
  backdrops: string[];
  code: CodeTerms | null;
  codeId: string | null;
  usageId: string | null;
}

/** The reservations' choices (best effort: none before migration 0032). */
export async function dueExtrasFor(ids: string[]): Promise<Map<string, DueExtras>> {
  const out = new Map<string, DueExtras>();
  if (!ids.length || !isDatabaseConfigured()) return out;
  try {
    const rows = await getDb().select().from(dueReservationExtras).where(inArray(dueReservationExtras.reservationId, ids));
    for (const x of rows) {
      const type = x.discountType === "percent" || x.discountType === "fixed" ? x.discountType : null;
      const code: CodeTerms | null = x.discountCode && type && x.discountValue != null ? { code: x.discountCode, type, value: x.discountValue } : null;
      out.set(x.reservationId, { backdrops: x.backdrops ?? [], code, codeId: x.codeId, usageId: x.usageId });
    }
  } catch (err) {
    if (!missingTable(err)) log.error("due.db", "Reservation choices not loaded", { error: safe(err) });
  }
  return out;
}

export const dueExtrasOf = async (id: string) => (await dueExtrasFor([id])).get(id) ?? null;

/**
 * The spot is reserved (deposit paid, or none needed): its code counts as used now, once. A code that was maxed out
 * meanwhile is still honored (the family saw it applied); that's logged. Best effort.
 */
async function claimDueCode(row: DueDateReservation): Promise<void> {
  const x = await dueExtrasOf(row.id);
  if (!x?.codeId || x.usageId) return;
  try {
    const usage = await claimCode(x.codeId, row.email);
    await getDb().update(dueReservationExtras).set({ usageId: usage.usageId, updatedAt: new Date() }).where(eq(dueReservationExtras.reservationId, row.id));
  } catch (err) {
    log.warn("due", "Code use not counted (the code is still honored)", { reference: row.reference, code: err instanceof BookingError ? err.code : undefined });
  }
}

/** A reservation cancelled or deleted: its code use is given back (best effort). */
async function releaseDueCode(id: string): Promise<void> {
  const x = await dueExtrasOf(id);
  if (!x?.usageId) return;
  const db = getDb();
  try {
    const freed = await db.delete(discountCodeUsage).where(eq(discountCodeUsage.id, x.usageId)).returning({ codeId: discountCodeUsage.codeId });
    for (const u of freed) await db.update(discountCodes).set({ usesCount: sql`greatest(${discountCodes.usesCount} - 1, 0)` }).where(eq(discountCodes.id, u.codeId));
    await db.update(dueReservationExtras).set({ usageId: null, updatedAt: new Date() }).where(eq(dueReservationExtras.reservationId, id));
  } catch (err) {
    log.error("due.db", "Code use not given back", { error: safe(err) });
  }
}

/**
 * /admin → Leads → Not paid → Delete (owner, Nov 11: test reservations): removes a reservation whose deposit isn't paid
 * and that has no booking. An open Stripe page is closed first (paid at the last second = refused: it's real now).
 */
export async function deleteDueReservation(id: string): Promise<void> {
  const db = getDb();
  const [row] = await db.select().from(dueDateReservations).where(eq(dueDateReservations.id, id)).limit(1);
  if (!row) return;
  if (row.bookingId || row.status === "scheduling" || row.status === "scheduled") throw new BookingError("invalid_request", "This reservation already has a booking: delete the booking in Leads instead.");
  if (row.depositStatus === "paid") throw new BookingError("invalid_request", "This deposit is paid: cancel it (and refund it) under Due dates instead.");
  if (row.stripeSessionId) {
    let session = await getCheckoutSession(row.stripeSessionId).catch(() => null);
    if (session?.status === "open") session = await expireCheckoutSession(session.id).catch(() => getCheckoutSession(row.stripeSessionId!).catch(() => null));
    if (session?.payment_status === "paid") {
      await dueDepositPaid(row.id, session);
      throw new BookingError("invalid_request", "Stripe says this deposit was just paid, so the spot is reserved now. Refresh the page.");
    }
  }
  await releaseDueCode(row.id);
  await db.delete(dueDateReservations).where(eq(dueDateReservations.id, row.id));
  log.info("due", "Reservation deleted from /admin", { reference: row.reference });
}

/**
 * A payment page the family can use now: the open one, else a new one (an expired reservation is waiting on its deposit
 * again). Throws BookingError when it was just paid or Stripe can't open one.
 */
async function ensureDuePayPage(start: DueDateReservation, hours: number): Promise<{ row: DueDateReservation; url: string }> {
  const db = getDb();
  let row = start;
  if (row.stripeSessionId && row.status !== "expired") {
    const session = await getCheckoutSession(row.stripeSessionId).catch(() => null);
    if (session?.payment_status === "paid") {
      await dueDepositPaid(row.id, session);
      throw new BookingError("invalid_request", "Stripe says this deposit was just paid: the spot is reserved. Refresh the page.");
    }
    if (session?.status === "open" && session.url) return { row, url: session.url };
  }
  const wasExpired = row.status === "expired";
  if (wasExpired) {
    const [again] = await db
      .update(dueDateReservations)
      .set({ status: "pending", depositStatus: "pending", updatedAt: new Date() })
      .where(and(eq(dueDateReservations.id, row.id), eq(dueDateReservations.status, "expired")))
      .returning();
    if (!again) throw new BookingError("invalid_request", "This reservation changed meanwhile. Refresh the page and try again.");
    row = again;
  }
  const url = await openDuePage(row, `due-deposit/${row.id}/${Date.now()}`, hours);
  if (!url) {
    if (wasExpired) await db.update(dueDateReservations).set({ status: "expired", depositStatus: "expired", updatedAt: new Date() }).where(eq(dueDateReservations.id, row.id)).catch(() => undefined);
    throw new BookingError("server_error", "Stripe couldn't open a payment page just now. Please try again.");
  }
  return { row, url };
}

/**
 * A reservation's deposit link (/pay?d=…&k=…, brief 04): a Stripe page for the saved reservation while its deposit is
 * missing (the open one, else a new one open an hour). "reserved" = already paid (or nothing to pay); "invalid" = a
 * bad link or a cancelled reservation.
 */
export async function duePayment(reference: string | null, signature: string | null): Promise<{ redirect: string } | { status: "reserved" | "invalid" | "error"; locale?: AppLocale }> {
  if (!reference || !signature || !verifyDuePay(reference, signature) || !isDatabaseConfigured()) return { status: "invalid" };
  const [row] = await getDb().select().from(dueDateReservations).where(eq(dueDateReservations.reference, reference)).limit(1);
  if (!row || row.status === "cancelled") return { status: "invalid", locale: row?.locale };
  if (!missingDeposit(row)) return { status: "reserved", locale: row.locale };
  if (!isStripeConfigured()) return { status: "error", locale: row.locale };
  try {
    return { redirect: (await ensureDuePayPage(row, 1)).url };
  } catch (err) {
    // just paid meanwhile: Stripe confirmed it while opening the page
    if (err instanceof BookingError && err.code === "invalid_request") return { status: "reserved", locale: row.locale };
    log.error("due", "Deposit page not opened from the pay link", { reference, code: err instanceof BookingError ? err.code : undefined });
    return { status: "error", locale: row.locale };
  }
}
/** The family booked or reserved (and paid) again since this reservation: nobody needs a reminder for it. */
async function dueMovedOn(row: DueDateReservation): Promise<boolean> {
  const db = getDb();
  const email = row.email.trim().toLowerCase();
  const [laterDue] = await db
    .select({ id: dueDateReservations.id })
    .from(dueDateReservations)
    .where(and(eq(sql`lower(${dueDateReservations.email})`, email), inArray(dueDateReservations.status, ["reserved", "scheduling", "scheduled"]), ne(dueDateReservations.depositStatus, "unpaid"), gt(dueDateReservations.createdAt, row.createdAt)))
    .limit(1);
  if (laterDue) return true;
  const [laterBooking] = await db.select({ id: bookings.id }).from(bookings).where(and(eq(sql`lower(${bookings.email})`, email), ne(bookings.status, "cancelled"), gt(bookings.createdAt, row.createdAt))).limit(1);
  return Boolean(laterBooking);
}

/**
 * The automatic "Finish reserving your spot" email (owner, Nov 11: no manual sending): when a family's payment page
 * closes unpaid, once per reservation (counted like a reminder, so Leads → Not paid shows it and the owner's
 * reminders still work). Its button opens their reservation page, which offers a new payment page. Never throws.
 */
async function autoRemindDue(row: DueDateReservation): Promise<void> {
  try {
    if (!row.depositCents || (await dueMovedOn(row))) return;
    const back = duePayPath(row.reference, row.locale);
    if (!back) return;
    // claim it: one automatic email per reservation (and none after one the owner sent)
    const claimed = await getDb()
      .insert(dueDepositReminders)
      .values({ reservationId: row.id })
      .onConflictDoNothing()
      .returning({ id: dueDepositReminders.reservationId })
      .catch((err) => (missingTable(err) ? [{ id: row.id }] : Promise.reject(err)));
    if (!claimed.length) return;
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    const mail = await dueDepositReminderEmail(
      { parentName: row.parentName, bundleName: row.packageName, dueDate: row.dueDate, amountCents: row.depositCents, bundlePriceCents: row.bundlePriceCents, offerLabel: row.bundlePriceCents < row.regularPriceCents ? row.offerLabel : null },
      { themeId, payUrl: `${base()}${back}`, locale: row.locale, auto: true },
    );
    await sendEmail({ scope: "resend.due_deposit_auto", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `due-unpaid/${row.id}`, reference: row.reference });
    log.info("due", "Automatic deposit reminder emailed", { reference: row.reference });
  } catch (err) {
    log.error("due", "Automatic deposit reminder not sent", { reference: row.reference, code: err instanceof EmailSendError ? err.code : undefined, error: safe(err) });
  }
}

/**
 * Backstop for a missed Stripe webhook (with the daily cron, availability checks and opening Leads): family payment
 * pages that should have closed by now are settled (paid → reserved; closed → expired + the automatic email).
 */
export async function sweepDueDeposits(now = new Date(), limit = 10): Promise<number> {
  if (!isDatabaseConfigured() || !isStripeConfigured()) return 0;
  let settled = 0;
  try {
    const stale = new Date(now.getTime() - 70 * 60_000);
    const rows = await getDb()
      .select()
      .from(dueDateReservations)
      .where(and(eq(dueDateReservations.status, "pending"), eq(dueDateReservations.depositStatus, "pending"), lt(dueDateReservations.updatedAt, stale)))
      .limit(limit);
    for (const row of rows) {
      const session = row.stripeSessionId ? await getCheckoutSession(row.stripeSessionId).catch(() => null) : null;
      if (session?.payment_status === "paid") await dueDepositPaid(row.id, session);
      else if (!session || session.status === "expired") await dueDepositExpired(row.id);
      else continue;
      settled++;
    }
  } catch (err) {
    if (!missingTable(err)) log.error("due", "Unpaid reservations not settled", { error: safe(err) });
  }
  return settled;
}
