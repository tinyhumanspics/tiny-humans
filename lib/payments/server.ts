import "server-only";
import { eq, sql } from "drizzle-orm";
import { site } from "@/config/site";
import { getDb } from "@/lib/db/client";
import { bookingPayments, bookings, type Booking } from "@/lib/db/schema";
import { formatLongDate } from "@/lib/booking/dates";
import { AFTER_KINDS, amountDueCents, findByEmailLink } from "@/lib/booking/after-session";
import { log } from "@/lib/log";
import { verifyPayLink } from "./link";
import { createCheckoutSession, getCheckoutSession, isStripeConfigured, type CheckoutSession } from "./stripe";

/**
 * Card payments, before or after the session. The booking's payment link (/pay?b=…&s=…, see ./link; older emails:
 * /pay?t=…) sends the family to a Stripe Checkout page for exactly the booked amount (a Checkout page lives 24 h at
 * most, so a fresh one is made when needed; an unexpired one is reused). "Paid" comes from the Stripe webhook, or from
 * checking the last page when the family opens the link again.
 */
export type PayOutcome = { redirect: string } | { status: "already" | "nothing" | "invalid" | "error" };

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
  if (!row || row.status === "cancelled") return { status: "invalid" };
  const amount = amountDueCents(row);
  if (amount <= 0) return { status: "nothing" };
  const db = getDb();
  const [payment] = await db.select().from(bookingPayments).where(eq(bookingPayments.bookingId, row.id)).limit(1);
  if (payment?.status === "paid") return { status: "already" };
  if (!isStripeConfigured()) {
    log.error("payments", "Pay link opened but STRIPE_SECRET_KEY is not set", { reference: row.bookingReference });
    return { status: "error" };
  }
  try {
    if (payment?.stripeSessionId) {
      const last = await getCheckoutSession(payment.stripeSessionId);
      if (last.payment_status === "paid") {
        await markPaid(row.id, last);
        return { status: "already" };
      }
      if (last.status === "open" && last.url && last.amount_total === amount && last.expires_at * 1000 > now.getTime() + WINDOW_MS) return { redirect: last.url };
    }
    const session = await createCheckoutSession({
      amountCents: amount,
      productName: `Tiny Humans · ${row.packageName}`,
      description: `Session ${row.bookingReference} on ${formatLongDate(row.sessionDate)}`,
      customerEmail: row.email,
      reference: row.bookingReference,
      bookingId: row.id,
      successUrl: statusUrl("paid"),
      cancelUrl: statusUrl("cancelled"),
      idempotencyKey: `checkout/${row.id}/${amount}/${Math.floor(now.getTime() / WINDOW_MS)}`,
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

/** Stripe webhook: a finished Checkout payment marks the booking paid (safe to receive twice). */
export async function handleStripeEvent(event: { type?: string; data?: { object?: CheckoutSession } }): Promise<void> {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return;
  const session = event.data?.object;
  const bookingId = session?.metadata?.booking_id;
  if (!session || session.payment_status !== "paid" || !bookingId) return;
  const [row] = await getDb().select({ id: bookings.id, reference: bookings.bookingReference }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!row) {
    log.warn("payments", "Paid session for an unknown booking", { reference: session.client_reference_id ?? undefined });
    return;
  }
  await markPaid(row.id, session);
  log.info("payments", "Booking paid", { reference: row.reference });
}
