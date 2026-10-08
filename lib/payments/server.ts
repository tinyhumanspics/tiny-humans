import "server-only";
import { eq, sql } from "drizzle-orm";
import { site } from "@/config/site";
import { getDb } from "@/lib/db/client";
import { bookingPayments, bookings, type Booking } from "@/lib/db/schema";
import { formatLongDate } from "@/lib/booking/dates";
import { AFTER_KINDS, findByEmailLink, nextCharge } from "@/lib/booking/after-session";
import { depositOf, depositPaidCents } from "@/lib/deposit/server";
import { depositPageExpired, depositPaid } from "@/lib/deposit/flow";
import { formatMoney } from "@/lib/pricing/engine";
import { bookingDeposits, type BookingDeposit } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { verifyPayLink } from "./link";
import { BookingError } from "@/lib/booking/errors";
import { fill } from "@/lib/email/messages";
import en from "@/messages/en.json";
import { createCheckoutSession, getCheckoutSession, isStripeConfigured, listCompletedCheckoutSessions, StripeError, type CheckoutSession } from "./stripe";

const isDepositPage = (s: CheckoutSession) => s.metadata?.kind === "deposit";

/**
 * Card payments, before or after the session. The booking's payment link (/pay?b=…&s=…, see ./link; older emails:
 * /pay?t=…) sends the family to a Stripe Checkout page for exactly the booked amount (a Checkout page lives 24 h at
 * most, so a fresh one is made when needed; an unexpired one is reused). "Paid" comes from the Stripe webhook, or from
 * checking the last page when the family opens the link again.
 */
export type PayOutcome = { redirect: string } | { status: "already" | "nothing" | "invalid" | "error" };
// The pay link can also take a deposit that Stripe couldn't take while booking (see nextCharge): its page is a
// "deposit" page, so the webhook records it on booking_deposits, never as the session's payment.

const statusUrl = (s: string) => `${site.url.replace(/\/$/, "")}/pay/status?s=${s}`;
/** Same Checkout page for repeated clicks (or link scanners) within 10 minutes. */
const WINDOW_MS = 10 * 60_000;

export async function markPaid(bookingId: string, session: CheckoutSession): Promise<void> {
  const now = new Date();
  const values = { status: "paid", paidAt: now, stripeSessionId: session.id, stripePaymentIntent: session.payment_intent, updatedAt: now };
  await getDb()
    .insert(bookingPayments)
    .values({ bookingId, amountCents: session.amount_total ?? 0, ...values })
    .onConflictDoUpdate({ target: bookingPayments.bookingId, set: { ...values, amountCents: session.amount_total ?? sql`${bookingPayments.amountCents}` } });
}

/** The booking behind a payment link: the signed booking link, or a token from an after-session/gallery email. */
export async function bookingForPayLink(q: { reference?: string | null; signature?: string | null; token?: string | null }): Promise<Booking | null> {
  if (q.reference && q.signature) {
    if (!verifyPayLink(q.reference, q.signature)) return null;
    const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, q.reference)).limit(1);
    return row ?? null;
  }
  return q.token ? findByEmailLink(q.token, [AFTER_KINDS.afterSession, AFTER_KINDS.gallery]) : null;
}

export async function openPayment(row: Booking | null, now = new Date()): Promise<PayOutcome> {
  // a pending booking isn't booked yet: its own deposit page is the way to pay
  if (!row || row.status === "cancelled" || row.status === "pending") return { status: "invalid" };
  const deposit = await depositOf(row.id);
  const next = nextCharge(row, deposit, now);
  if (next.amountCents <= 0) return { status: "nothing" };
  if (!isStripeConfigured()) {
    log.error("payments", "Pay link opened but STRIPE_SECRET_KEY is not set", { reference: row.bookingReference });
    return { status: "error" };
  }
  if (next.kind === "deposit" && deposit) return openDepositPayment(row, deposit, now);
  const amount = next.amountCents;
  const db = getDb();
  const [payment] = await db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, row.id)).limit(1);
  if (payment?.status === "paid") return { status: "already" };
  try {
    if (payment?.stripeSessionId) {
      const last = await getCheckoutSession(payment.stripeSessionId);
      if (last.payment_status === "paid") {
        await markPaid(row.id, last);
        return { status: "already" };
      }
      if (last.status === "open" && last.url && last.amount_total === amount && last.expires_at * 1000 > now.getTime() + WINDOW_MS) return { redirect: last.url };
    }
    // a second line for the travel fee, unless a deposit already covered part of it
    const travelCents = row.travelFeeCents ?? 0;
    const paidDeposit = depositPaidCents(deposit);
    const split = travelCents > 0 && amount - travelCents > 0;
    const session = await createCheckoutSession({
      amountCents: split ? amount - travelCents : amount,
      extraLine: split ? { name: fill(en.booking.travel.stripeLine, { miles: String(row.travelMiles ?? "") }), amountCents: travelCents } : undefined,
      productName: paidDeposit ? fill(en.deposit.stripe.balanceProduct, { bundle: row.packageName, deposit: formatMoney(paidDeposit) }) : `Tiny Humans · ${row.packageName}`,
      description: `Session ${row.bookingReference} on ${formatLongDate(row.sessionDate)}`,
      customerEmail: row.email,
      reference: row.bookingReference,
      bookingId: row.id,
      successUrl: statusUrl("paid"),
      cancelUrl: statusUrl("cancelled"),
      idempotencyKey: `checkout/${row.id}/${amount}/${Math.floor(now.getTime() / WINDOW_MS)}`,
      kind: "balance",
    });
    await db
      .insert(bookingPayments)
      .values({ bookingId: row.id, amountCents: amount, status: "open", stripeSessionId: session.id, updatedAt: now })
      .onConflictDoUpdate({ target: bookingPayments.bookingId, set: { amountCents: amount, stripeSessionId: session.id, updatedAt: now }, setWhere: sql`${bookingPayments.status} <> 'paid'` });
    if (!session.url) throw new Error("Stripe returned no payment page URL");
    log.info("payments", "Payment page opened", { reference: row.bookingReference });
    return { redirect: session.url };
  } catch (err) {
    log.error("payments", "Could not open the payment page", { reference: row.bookingReference, error: err as Error });
    return { status: "error" };
  }
}

/** The payment link of a booking whose deposit Stripe couldn't take while booking: a page for the deposit first. */
async function openDepositPayment(row: Booking, deposit: BookingDeposit, now: Date): Promise<PayOutcome> {
  try {
    if (deposit.stripeSessionId) {
      const last = await getCheckoutSession(deposit.stripeSessionId);
      if (last.payment_status === "paid") {
        await depositPaid(row.id, last);
        return { status: "already" };
      }
      if (last.status === "open" && last.url && last.expires_at * 1000 > now.getTime() + WINDOW_MS) return { redirect: last.url };
    }
    const total = (row.finalPriceCents ?? row.packagePrice * 100) + (row.travelFeeCents ?? 0);
    const session = await createCheckoutSession({
      amountCents: deposit.amountCents,
      productName: fill(en.deposit.stripe.product, { bundle: row.packageName }),
      description: fill(en.deposit.stripe.linkDescription, { reference: row.bookingReference, date: formatLongDate(row.sessionDate), total: formatMoney(total) }),
      customerEmail: row.email,
      reference: row.bookingReference,
      bookingId: row.id,
      successUrl: statusUrl("deposit"),
      cancelUrl: statusUrl("cancelled"),
      idempotencyKey: `deposit-link/${row.id}/${Math.floor(now.getTime() / WINDOW_MS)}`,
      kind: "deposit",
    });
    await getDb().update(bookingDeposits).set({ stripeSessionId: session.id, updatedAt: now }).where(eq(bookingDeposits.bookingId, row.id));
    if (!session.url) throw new Error("Stripe returned no payment page URL");
    log.info("payments", "Deposit page opened from the payment link", { reference: row.bookingReference });
    return { redirect: session.url };
  } catch (err) {
    log.error("payments", "Could not open the deposit page", { reference: row.bookingReference, error: err as Error });
    return { status: "error" };
  }
}

/**
 * Owner's "Check with Stripe" (a backup for a missed webhook): the booking's last Checkout page, then every completed
 * Checkout page paid with the family's email, matched by the booking id in its metadata. Records a payment it finds.
 */
export async function checkPaymentWithStripe(row: Booking): Promise<void> {
  const [[payment], deposit] = await Promise.all([getDb().select().from(bookingPayments).where(eq(bookingPayments.bookingId, row.id)).limit(1), depositOf(row.id)]);
  const depositWaiting = deposit?.status === "pending" || deposit?.status === "unpaid";
  if (payment?.status === "paid" && !depositWaiting) return;
  if (!isStripeConfigured()) throw new BookingError("invalid_request", "Stripe isn't connected (STRIPE_SECRET_KEY is missing in Vercel).");
  try {
    // the saved pages are only a shortcut: if Stripe can't return them, the email search below still runs
    let completed: CheckoutSession[] | null = null;
    const paidPage = async (savedId: string | null | undefined, wantDeposit: boolean) => {
      const last = savedId ? await getCheckoutSession(savedId).catch(() => null) : null;
      if (last?.payment_status === "paid") return last;
      completed ??= (await listCompletedCheckoutSessions(row.email)).data;
      return completed.find((s) => s.metadata?.booking_id === row.id && s.payment_status === "paid" && isDepositPage(s) === wantDeposit);
    };
    if (depositWaiting) {
      const paid = await paidPage(deposit.stripeSessionId, true);
      if (paid) {
        await depositPaid(row.id, paid);
        log.info("payments", "Deposit found with Check with Stripe", { reference: row.bookingReference });
      }
    }
    if (payment?.status !== "paid") {
      const paid = await paidPage(payment?.stripeSessionId, false);
      if (paid) {
        await markPaid(row.id, paid);
        log.info("payments", "Payment found with Check with Stripe", { reference: row.bookingReference });
      }
    }
  } catch (err) {
    log.error("payments", "Check with Stripe failed", { reference: row.bookingReference, error: err as Error });
    throw new BookingError("server_error", err instanceof StripeError ? `Stripe didn't answer (${err.code}). Please try again.` : "Couldn't check with Stripe. Please try again.");
  }
}

/**
 * Stripe webhook (safe to receive twice). A finished payment page marks the booking paid; a deposit page (metadata
 * kind "deposit") records the deposit and confirms a pending booking, and an expired deposit page frees its time.
 * Throws (→ 500, Stripe delivers it again later) when a paid booking couldn't be confirmed yet.
 */
export async function handleStripeEvent(event: { type?: string; data?: { object?: CheckoutSession } }): Promise<void> {
  const session = event.data?.object;
  const bookingId = session?.metadata?.booking_id;
  if (!session || !bookingId) return;
  if (event.type === "checkout.session.expired") {
    if (isDepositPage(session)) await depositPageExpired(bookingId, session);
    return;
  }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return;
  if (session.payment_status !== "paid") return;
  if (isDepositPage(session)) {
    if ((await depositPaid(bookingId, session)) === "failed") throw new Error("Deposit paid, but the booking isn't confirmed yet");
    return;
  }
  const [row] = await getDb().select({ id: bookings.id, reference: bookings.bookingReference }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!row) {
    log.warn("payments", "Paid session for an unknown booking", { reference: session.client_reference_id ?? undefined });
    return;
  }
  await markPaid(row.id, session);
  log.info("payments", "Booking paid", { reference: row.reference });
}
