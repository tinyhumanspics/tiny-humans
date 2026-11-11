import "server-only";
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
import { bookingDeposits, bookings, dueDateReservations, dueDepositReminders, type DueDateReservation } from "@/lib/db/schema";
import { getDepositSettings } from "@/lib/deposit/server";
import { depositCentsFor } from "@/lib/deposit/types";
import { dueDepositReminderEmail, dueReservedEmail, internalDueReservedEmail } from "@/lib/email";
import { fill } from "@/lib/email/messages";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { dueReturnPath, verifyDueReturn } from "@/lib/payments/link";
import { createCheckoutSession, createRefund, getCheckoutSession, isStripeConfigured, StripeError, type CheckoutSession } from "@/lib/payments/stripe";
import { computeQuote, formatMoney } from "@/lib/pricing/engine";
import { getCatalog } from "@/lib/pricing/server";
import type { Bundle } from "@/lib/pricing/types";
import { getSiteSettings } from "@/lib/settings/server";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { dueWindow, type DueCreateResult, type DueReservationRow, type DueSummary } from "./types";
import type { DueRequest } from "./validation";
import { markDraftBooked } from "@/lib/unfinished/server";
import type { NotPaidDue } from "@/lib/leads/types";

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

/** New reservation from the "Not born yet" form. Throws BookingError with a message the family can read. */
export async function createDueReservation(r: DueRequest): Promise<DueCreateResult> {
  if (!isDatabaseConfigured()) throw new BookingError("server_error", "Reservations need the database. Please text us and we'll reserve your spot.");
  const messages = r.locale === "es" ? es : en;
  const t = messages.dueDate.errors;
  const db = getDb();
  const bundle = (await getCatalog()).find((b) => b.id === r.bundleId && b.active !== false);
  if (!bundle) throw new BookingError("invalid_request", t.bundle);
  if (r.babyCount > 1 && !extraBabyLine(bundle, r.babyCount)) throw new BookingError("invalid_request", t.babies);
  const today = todayInZone(bookingRules.timeZone);
  const window = dueWindow(today);
  if (r.dueDate < window.from || r.dueDate > window.to) throw new BookingError("invalid_request", t.window);

  // the same submission again (double tap, slow network): the same reservation (and its payment page while open)
  if (r.requestId) {
    const [existing] = await db.select().from(dueDateReservations).where(eq(dueDateReservations.requestId, r.requestId)).limit(1);
    if (existing) return resultOf(existing);
  }

  const travel = travelQuote(r.address.zip, await getTravelSettings());
  if (travel.status === "outside_florida") throw new BookingError("invalid_request", messages.bookingFlow.details.travel.outsideFlorida);
  if (travel.status === "too_far") throw new BookingError("invalid_request", fill(messages.bookingFlow.details.travel.tooFar, { phone: site.contact.phone }));
  const pricing = computeQuote(bundle, today);
  const travelCents = travel.status === "fee" ? travel.feeCents : 0;
  const depositCents = depositCentsFor(pricing.finalCents + travelCents, bundle.id, await getDepositSettings());
  const id = crypto.randomUUID();
  const token = dueTokenFor(id);
  if (!token) throw new BookingError("server_error", t.server);

  let row: DueDateReservation | undefined;
  for (let attempt = 0; attempt < 4 && !row; attempt++) {
    try {
      [row] = await db
        .insert(dueDateReservations)
        .values({
          id,
          reference: reference(),
          requestId: r.requestId,
          packageId: bundle.id,
          packageName: bundle.name,
          regularPriceCents: pricing.regularCents,
          bundlePriceCents: pricing.finalCents,
          offerLabel: pricing.offerLabel,
          babyCount: r.babyCount,
          dueDate: r.dueDate,
          parentName: r.contact.parentName,
          email: r.contact.email,
          phone: r.contact.phone,
          locale: r.locale ?? "en",
          street: r.address.street,
          unit: r.address.unit ?? null,
          city: r.address.city,
          zip: r.address.zip.slice(0, 5),
          notes: r.contact.notes ?? null,
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
      if (isUniqueViolation(err, "request_id")) throw new BookingError("in_progress", t.inProgress);
      log.error("due.db", missingTable(err) ? "due_date_reservations is missing: run drizzle/0026_due_dates.sql" : "Reservation not saved", { error: safe(err) });
      throw new BookingError("server_error", t.server);
    }
  }
  if (!row) throw new BookingError("server_error", t.server);
  // Unfinished bookings: this family's "Not born yet?" draft is now a reservation (best effort, never throws)
  await markDraftBooked(row.email, row.reference);

  if (depositCents > 0) {
    const url = await openDuePage(row);
    if (url) return { reference: row.reference, status: "pending", depositUrl: url };
    // Stripe not reachable: reserved without the deposit (flagged in /admin; the studio follows up), like bookings
    [row] = await db.update(dueDateReservations).set({ status: "reserved", depositStatus: "unpaid", updatedAt: new Date() }).where(eq(dueDateReservations.id, row.id)).returning();
  }
  await sendDueEmails(row);
  return { reference: row.reference, status: "reserved", donePath: dueReturnPath(row.reference, row.locale) ?? undefined };
}

/** The Stripe page for the deposit (open 24 hours: nothing is held meanwhile). Null when Stripe can't. */
async function openDuePage(row: DueDateReservation, idempotencyKey = `due-deposit/${row.id}`): Promise<string | null> {
  const back = dueReturnPath(row.reference, row.locale);
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
      successUrl: `${base()}${back}&paid=1`,
      cancelUrl: `${base()}${back}`,
      idempotencyKey,
      kind: "due_deposit",
      expiresAt: Math.floor(Date.now() / 1000) + 23 * 3600,
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

async function resultOf(row: DueDateReservation): Promise<DueCreateResult> {
  if (row.status === "pending" && row.stripeSessionId) {
    const session = await getCheckoutSession(row.stripeSessionId).catch(() => null);
    if (session?.status === "open" && session.url) return { reference: row.reference, status: "pending", depositUrl: session.url };
  }
  return { reference: row.reference, status: row.status === "pending" ? "pending" : "reserved", donePath: dueReturnPath(row.reference, row.locale) ?? undefined };
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
  await sendDueEmails(row);
}

/** The deposit page closed unpaid: the reservation ends (the family can reserve again; nothing was held). */
export async function dueDepositExpired(id: string): Promise<void> {
  await getDb()
    .update(dueDateReservations)
    .set({ status: "expired", depositStatus: "expired", updatedAt: new Date() })
    .where(and(eq(dueDateReservations.id, id), eq(dueDateReservations.status, "pending")));
}

/** The page after Stripe: reserved / still waiting (asks Stripe in case the webhook is late) / not valid. */
export async function dueReturnState(referenceValue: string, signature: string): Promise<{ state: "reserved" | "pending" | "expired" | "invalid"; row?: DueDateReservation; payUrl?: string }> {
  if (!verifyDueReturn(referenceValue, signature) || !isDatabaseConfigured()) return { state: "invalid" };
  let [row] = await getDb().select().from(dueDateReservations).where(eq(dueDateReservations.reference, referenceValue)).limit(1);
  if (!row) return { state: "invalid" };
  // reserved while Stripe was down: a deposit reminder from /admin opens its page (the spot stays reserved meanwhile)
  const awaiting = row.status === "pending" || (row.status === "reserved" && row.depositStatus === "unpaid");
  if (awaiting && row.stripeSessionId) {
    const session = await getCheckoutSession(row.stripeSessionId).catch(() => null);
    if (session?.payment_status === "paid") {
      await dueDepositPaid(row.id, session);
      [row] = await getDb().select().from(dueDateReservations).where(eq(dueDateReservations.id, row.id)).limit(1);
    } else if (session?.status === "open" && session.url) {
      return { state: "pending", row, payUrl: session.url };
    } else if (session?.status === "expired" && row.status === "pending") {
      await dueDepositExpired(row.id);
      return { state: "expired", row };
    }
  }
  if (row.status === "pending") return { state: "pending", row };
  if (row.status === "expired" || row.status === "cancelled") return { state: "expired", row };
  return { state: "reserved", row };
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
export function dueSummaryOf(row: DueDateReservation): DueSummary {
  return {
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
  };
  try {
    const mail = await dueReservedEmail(details, { themeId, scheduleUrl, locale: row.locale });
    await sendEmail({ scope: "resend.due_reserved", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `due-reserved/${row.reference}`, reference: row.reference });
  } catch (err) {
    log.error("due", "'Spot reserved' email not sent", { reference: row.reference, code: err instanceof EmailSendError ? err.code : "send_failed" });
  }
  try {
    const mail = await internalDueReservedEmail({ ...details, email: row.email, phone: row.phone, address: [row.street, row.unit, row.city, row.zip].filter(Boolean).join(", "), notes: row.notes, depositStatus: row.depositStatus, depositCents: row.depositCents, travelFeeCents: row.travelFeeCents, travelMiles: row.travelMiles, scheduleUrl, leadsUrl: `${base()}/admin/leads?view=due` });
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

/** Waiting reservations, for the dashboard and the Leads tab count (0 when the table is missing). */
export async function countWaitingDue(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const rows = await getDb().select({ id: dueDateReservations.id }).from(dueDateReservations).where(inArray(dueDateReservations.status, ["reserved", "scheduling"]));
    return rows.length;
  } catch {
    return 0;
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
export async function remindDueDeposit(id: string): Promise<void> {
  const db = getDb();
  let [row] = await db.select().from(dueDateReservations).where(eq(dueDateReservations.id, id)).limit(1);
  if (!row) throw new BookingError("invalid_request", "That reservation isn't here anymore. Refresh the page.");
  if (!missingDeposit(row)) throw new BookingError("invalid_request", "This reservation's deposit isn't missing anymore. Refresh the page.");
  if (!isStripeConfigured()) throw new BookingError("server_error", "Stripe isn't connected (STRIPE_SECRET_KEY is missing in Vercel).");
  const back = dueReturnPath(row.reference, row.locale);
  if (!back) throw new BookingError("server_error", "Payment links need ADMIN_SESSION_SECRET.");
  let open = false;
  if (row.stripeSessionId && row.status !== "expired") {
    const session = await getCheckoutSession(row.stripeSessionId).catch(() => null);
    if (session?.payment_status === "paid") {
      await dueDepositPaid(row.id, session);
      throw new BookingError("invalid_request", "Stripe says this deposit was just paid: the spot is reserved. Refresh the page.");
    }
    open = session?.status === "open";
  }
  if (!open) {
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
    if (!(await openDuePage(row, `due-deposit/${row.id}/${Date.now()}`))) {
      if (wasExpired) await db.update(dueDateReservations).set({ status: "expired", depositStatus: "expired", updatedAt: new Date() }).where(eq(dueDateReservations.id, row.id)).catch(() => undefined);
      throw new BookingError("server_error", "Stripe couldn't open a payment page just now. Please try again.");
    }
  }
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
  await db
    .insert(dueDepositReminders)
    .values({ reservationId: row.id })
    .onConflictDoUpdate({ target: dueDepositReminders.reservationId, set: { count: sql`${dueDepositReminders.count} + 1`, lastSentAt: new Date() } })
    .catch((err) => {
      if (!missingTable(err)) log.error("due.db", "Deposit reminder not counted", { reference: row.reference, error: safe(err) });
    });
}
