import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isMissingTable } from "@/lib/db/client";
import { bookingEmails, bookings, photoExtraOrders, photoExtrasSettings, type Booking, type PhotoExtraOrder } from "@/lib/db/schema";
import { photosLabelOf, termsFor } from "@/lib/booking/terms";
import { extrasUrl, verifyExtrasLink } from "@/lib/payments/link";
import { createCheckoutSession, getCheckoutSession, isStripeConfigured, type CheckoutSession } from "@/lib/payments/stripe";
import { formatMoney } from "@/lib/pricing/engine";
import { fill } from "@/lib/email/messages";
import { log } from "@/lib/log";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { sendExtrasPaidEmails } from "./emails";
import { lineName } from "./format";
import { boughtFrom, NO_PURCHASES, priceOrder, whatsLeft, type PriceError } from "./math";
import type { ExtraLine, ExtrasChoice, ExtrasLeft, ExtrasSettings, ExtrasView, LeadExtrasOrder } from "./types";

/**
 * Photo extras after the session (owner, Nov 20). The sneak-peek email links a signed page (/extras?b=…&s=…) where
 * the family picks extra edited photos, the full gallery and/or the unedited files and pays on Stripe; the webhook
 * marks the order paid, and the family and the studio get an email. Prices come from /admin → Pricing and are copied
 * into each order.
 */

// ---------- settings ----------

/** The owner's extras settings, or null when not saved (or the table is missing): no extras offered. */
export async function getExtrasSettings(): Promise<ExtrasSettings | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb().select().from(photoExtrasSettings).where(eq(photoExtrasSettings.id, 1)).limit(1);
    if (!row) return null;
    const { id: _id, updatedAt: _u, ...settings } = row;
    return settings;
  } catch (err) {
    if (!isMissingTable(err)) log.error("photo-extras", "Could not load the extras settings (no extras offered)", { error: err as Error });
    return null;
  }
}

export async function saveExtrasSettings(s: ExtrasSettings): Promise<void> {
  const values = { ...s, updatedAt: new Date() };
  await getDb().insert(photoExtrasSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: photoExtrasSettings.id, set: values });
}

// ---------- orders ----------

const linesOf = (o: PhotoExtraOrder) => o.lines as ExtraLine[];

async function ordersOf(bookingId: string): Promise<PhotoExtraOrder[]> {
  return getDb().select().from(photoExtraOrders).where(eq(photoExtraOrders.bookingId, bookingId)).orderBy(desc(photoExtraOrders.createdAt));
}

const boughtOf = (orders: PhotoExtraOrder[]) => boughtFrom(orders.filter((o) => o.status === "paid").map((o) => ({ lines: linesOf(o) })));

/** Every booking's orders, newest first, for /admin → Leads (empty before migration 0045). */
export async function extrasForBookings(ids: string[]): Promise<Map<string, LeadExtrasOrder[]>> {
  const out = new Map<string, LeadExtrasOrder[]>();
  if (!ids.length) return out;
  try {
    const rows = await getDb().select().from(photoExtraOrders).where(inArray(photoExtraOrders.bookingId, ids)).orderBy(desc(photoExtraOrders.createdAt));
    for (const o of rows) {
      out.set(o.bookingId, [
        ...(out.get(o.bookingId) ?? []),
        { id: o.id, lines: linesOf(o), creditCents: o.creditCents, totalCents: o.totalCents, note: o.note, status: o.status as LeadExtrasOrder["status"], createdAt: o.createdAt.toISOString(), paidAt: o.paidAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null },
      ]);
    }
  } catch (err) {
    if (!isMissingTable(err)) log.error("photo-extras", "Could not load extras orders", { error: err as Error });
  }
  return out;
}

/** /admin → Leads "Delivered" tick: saves when (or clears it). Sends nothing. */
export async function setExtrasDelivered(bookingId: string, orderId: string, delivered: boolean): Promise<boolean> {
  const rows = await getDb()
    .update(photoExtraOrders)
    .set({ deliveredAt: delivered ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(photoExtraOrders.id, orderId), eq(photoExtraOrders.bookingId, bookingId), eq(photoExtraOrders.status, "paid")))
    .returning({ id: photoExtraOrders.id });
  return rows.length > 0;
}

// ---------- the page ----------

/** The page stays open `openDays` after the sneak-peek email (or after the session, if that email wasn't sent). */
async function isOpen(row: Booking, s: ExtrasSettings, now: Date): Promise<boolean> {
  if (!s.enabled) return false;
  const [sneak] = await getDb()
    .select({ sentAt: bookingEmails.sentAt })
    .from(bookingEmails)
    .where(and(eq(bookingEmails.bookingId, row.id), eq(bookingEmails.kind, "after_session"), eq(bookingEmails.status, "sent")))
    .orderBy(desc(bookingEmails.sentAt))
    .limit(1);
  const start = sneak?.sentAt ?? row.sessionStart;
  return now.getTime() <= start.getTime() + s.openDays * 86_400_000;
}

async function bookingForLink(reference: unknown, signature: unknown): Promise<Booking | null> {
  if (typeof reference !== "string" || typeof signature !== "string" || !verifyExtrasLink(reference, signature)) return null;
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return row && (row.status === "confirmed" || row.status === "rescheduled") ? row : null;
}

/** The newest paid order still waiting to be found after Stripe (the webhook may be a few seconds behind). */
async function confirmWithStripe(order: PhotoExtraOrder | undefined): Promise<void> {
  if (!order?.stripeSessionId || order.status !== "open" || !isStripeConfigured()) return;
  const session = await getCheckoutSession(order.stripeSessionId).catch(() => null);
  if (session?.payment_status === "paid") await markExtrasPaid(order.id, session);
}

/** GET /api/extras: what the page shows. `paid`: back from Stripe (the thank-you, once the payment is in). */
export async function extrasView(reference: unknown, signature: unknown, paid: boolean, now = new Date()): Promise<ExtrasView> {
  const row = await bookingForLink(reference, signature);
  if (!row) return { state: "invalid" };
  const settings = await getExtrasSettings();
  if (!settings || !(await isOpen(row, settings, now))) return { state: "closed" };
  if (paid) await confirmWithStripe((await ordersOf(row.id)).find((o) => o.status === "open"));
  const orders = await ordersOf(row.id);
  const left = whatsLeft(settings, boughtOf(orders));
  const newestPaid = orders.find((o) => o.status === "paid");
  const [terms] = await termsFor([row.id]);
  return {
    state: paid && newestPaid ? "paid" : left.nothingLeft ? "nothing" : "open",
    firstName: row.parentName.split(" ")[0],
    bundleName: row.packageName,
    included: photosLabelOf(row, terms),
    prices: { extraPhotoCents: settings.extraPhotoCents, maxExtras: settings.maxExtras, fullGalleryCents: settings.fullGalleryCents, rawFilesCents: settings.rawFilesCents },
    left,
    ...(paid && newestPaid ? { paidOrder: { lines: linesOf(newestPaid), creditCents: newestPaid.creditCents, totalCents: newestPaid.totalCents } } : {}),
  };
}

export type CheckoutOutcome = { url: string } | { error: "invalid" | "closed" | "stripe" | PriceError };

/**
 * POST /api/extras: prices the choice again on the server (prices, the cap, the credit, what's already bought), saves
 * it on the booking's open order (one per booking, reused) and opens a Stripe page for it.
 */
export async function startExtrasCheckout(reference: unknown, signature: unknown, choice: ExtrasChoice, note: string, now = new Date()): Promise<CheckoutOutcome> {
  const row = await bookingForLink(reference, signature);
  if (!row) return { error: "invalid" };
  const settings = await getExtrasSettings();
  if (!settings || !(await isOpen(row, settings, now))) return { error: "closed" };
  if (!isStripeConfigured()) {
    log.error("photo-extras", "Extras checkout opened but STRIPE_SECRET_KEY is not set", { reference: row.bookingReference });
    return { error: "stripe" };
  }
  await confirmWithStripe((await ordersOf(row.id)).find((o) => o.status === "open"));
  const orders = await ordersOf(row.id);
  const priced = priceOrder(settings, boughtOf(orders), choice);
  if ("error" in priced) return priced;
  const db = getDb();
  const values = { lines: priced.lines, creditCents: priced.creditCents, totalCents: priced.totalCents, note: note.trim().slice(0, 500) || null, updatedAt: now };
  const open = orders.find((o) => o.status === "open");
  const [order] = open
    ? await db.update(photoExtraOrders).set(values).where(and(eq(photoExtraOrders.id, open.id), eq(photoExtraOrders.status, "open"))).returning()
    : await db.insert(photoExtraOrders).values({ bookingId: row.id, ...values }).onConflictDoNothing().returning();
  if (!order) return { error: "stripe" }; // another tab changed it a moment ago
  const m = row.locale === "es" ? es : en;
  const back = extrasUrl(row.bookingReference, row.locale);
  if (!back) return { error: "stripe" };
  try {
    const names = priced.lines.map((l) =>
      l.kind === "full_gallery" && priced.creditCents > 0 ? fill(m.extras.stripe.creditLine, { name: lineName(l, m.extras), amount: formatMoney(priced.creditCents) }) : lineName(l, m.extras),
    );
    const amounts = priced.lines.map((l) => (l.kind === "full_gallery" ? l.totalCents - priced.creditCents : l.totalCents));
    const session = await createCheckoutSession({
      amountCents: amounts[0],
      productName: names[0],
      description: fill(m.extras.stripe.description, { reference: row.bookingReference }),
      extraLines: names.slice(1).map((name, i) => ({ name, amountCents: amounts[i + 1] })),
      customerEmail: row.email,
      reference: row.bookingReference,
      bookingId: row.id,
      successUrl: `${back}&paid=1`,
      cancelUrl: back,
      idempotencyKey: `extras/${order.id}/${priced.totalCents}/${priced.lines.map((l) => `${l.kind}${l.quantity}`).join("-")}/${Math.floor(now.getTime() / 600_000)}`,
      kind: "photo_extras",
      metadata: { order_id: order.id },
    });
    await db.update(photoExtraOrders).set({ stripeSessionId: session.id, updatedAt: new Date() }).where(eq(photoExtraOrders.id, order.id));
    if (!session.url) throw new Error("Stripe returned no payment page URL");
    log.info("photo-extras", "Extras payment page opened", { reference: row.bookingReference });
    return { url: session.url };
  } catch (err) {
    log.error("photo-extras", "Could not open the extras payment page", { reference: row.bookingReference, error: err as Error });
    return { error: "stripe" };
  }
}

// ---------- paid ----------

/** Marks an order paid (safe to call twice: only the first call sends the family's thank-you and the studio's notice). */
export async function markExtrasPaid(orderId: string, session: CheckoutSession): Promise<void> {
  const now = new Date();
  const [order] = await getDb()
    .update(photoExtraOrders)
    .set({ status: "paid", paidAt: now, stripeSessionId: session.id, stripePaymentIntent: session.payment_intent, updatedAt: now })
    .where(and(eq(photoExtraOrders.id, orderId), eq(photoExtraOrders.status, "open")))
    .returning();
  if (!order) return;
  if (session.amount_total !== null && session.amount_total !== order.totalCents) log.warn("photo-extras", "Paid amount differs from the order total", { order: order.id });
  const [row] = await getDb().select().from(bookings).where(eq(bookings.id, order.bookingId)).limit(1);
  log.info("photo-extras", "Photo extras paid", { reference: row?.bookingReference });
  if (row) await sendExtrasPaidEmails(row, order).catch((err) => log.error("photo-extras", "Extras emails not sent", { reference: row.bookingReference, error: err as Error }));
}

/** Stripe webhook, metadata kind "photo_extras". An expired page leaves the order open (the page reuses it). */
export async function handleExtrasEvent(event: { type?: string; data?: { object?: CheckoutSession } }): Promise<void> {
  const session = event.data?.object;
  const orderId = session?.metadata?.order_id;
  if (!session || !orderId) return;
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && session.payment_status === "paid") await markExtrasPaid(orderId, session);
}

// ---------- the sneak-peek email ----------

/** What the sneak-peek email offers: null when extras are off or nothing is left to buy. */
export async function extrasOfferFor(row: Booking): Promise<{ settings: ExtrasSettings; left: ExtrasLeft; url: string } | null> {
  const settings = await getExtrasSettings();
  const url = extrasUrl(row.bookingReference, row.locale);
  if (!settings?.enabled || !url) return null;
  const left = whatsLeft(settings, await ordersOf(row.id).then(boughtOf).catch(() => NO_PURCHASES));
  return left.nothingLeft ? null : { settings, left, url };
}
