import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal Stripe client (no SDK): Checkout Sessions, refunds + webhook signature checks.
 * Env: STRIPE_SECRET_KEY (a restricted key `rk_...` with "Checkout Sessions: Write" and, for deposit refunds, "Refunds:
 * Write"), STRIPE_WEBHOOK_SECRET
 * (`whsec_...`). STRIPE_API_BASE is for local tests only (a fake Stripe); never set it on Vercel.
 */
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const apiBase = () => (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/$/, "");

export class StripeError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "StripeError";
  }
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  expires_at: number;
  payment_intent: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
  /** Hosted page only. */
  customer_details?: { email?: string | null } | null;
}

async function call<T>(method: "GET" | "POST", path: string, form?: Record<string, string>, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("not_configured", "STRIPE_SECRET_KEY is not set");
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/v1/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new StripeError("network_error", "Could not reach Stripe");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { type?: string; code?: string; message?: string } }) | null;
  if (!res.ok || !body) throw new StripeError(body?.error?.code ?? body?.error?.type ?? `http_${res.status}`, body?.error?.message ?? "Stripe request failed");
  return body;
}

export function createCheckoutSession(input: {
  amountCents: number;
  productName: string;
  description: string;
  customerEmail: string;
  reference: string;
  bookingId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  /** A second line on the payment page (the travel fee). */
  extraLine?: { name: string; amountCents: number };
  /** "deposit" (paid while booking) or "balance" (the payment link); the webhook tells them apart by this. */
  kind?: "deposit" | "balance";
  /** When the page expires (epoch seconds, 30 min to 24 h from now; Stripe's default is 24 h). */
  expiresAt?: number;
  /** "book" labels the button "Book"; default "pay". */
  submitType?: "pay" | "book";
  /** A short message shown above the pay button. */
  submitMessage?: string;
}): Promise<CheckoutSession> {
  return call<CheckoutSession>(
    "POST",
    "checkout/sessions",
    {
      mode: "payment",
      submit_type: input.submitType ?? "pay",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.productName,
      "line_items[0][price_data][product_data][description]": input.description,
      ...(input.extraLine
        ? {
            "line_items[1][quantity]": "1",
            "line_items[1][price_data][currency]": "usd",
            "line_items[1][price_data][unit_amount]": String(input.extraLine.amountCents),
            "line_items[1][price_data][product_data][name]": input.extraLine.name,
          }
        : {}),
      customer_email: input.customerEmail,
      client_reference_id: input.reference,
      "metadata[booking_id]": input.bookingId,
      "metadata[booking_reference]": input.reference,
      ...(input.kind ? { "metadata[kind]": input.kind, "payment_intent_data[metadata][kind]": input.kind } : {}),
      ...(input.expiresAt ? { expires_at: String(input.expiresAt) } : {}),
      ...(input.submitMessage ? { "custom_text[submit][message]": input.submitMessage } : {}),
      "payment_intent_data[description]": input.description,
      "payment_intent_data[metadata][booking_reference]": input.reference,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    input.idempotencyKey,
  );
}

export const getCheckoutSession = (id: string) => call<CheckoutSession>("GET", `checkout/sessions/${encodeURIComponent(id)}`);

/** Closes an open Checkout page now (nobody can pay on it afterwards). https://docs.stripe.com/api/checkout/sessions/expire */
export const expireCheckoutSession = (id: string) => call<CheckoutSession>("POST", `checkout/sessions/${encodeURIComponent(id)}/expire`, {});

export interface Refund {
  id: string;
  amount: number;
  /** pending | requires_action | succeeded | failed | canceled */
  status: string | null;
  failure_reason?: string | null;
}

/** Refunds a card payment (in full unless `amountCents`). Needs "Refunds: Write". https://docs.stripe.com/api/refunds/create */
export const createRefund = (input: { paymentIntent: string; reference: string; amountCents?: number; idempotencyKey: string }) =>
  call<Refund>(
    "POST",
    "refunds",
    {
      payment_intent: input.paymentIntent,
      reason: "requested_by_customer",
      "metadata[booking_reference]": input.reference,
      ...(input.amountCents ? { amount: String(input.amountCents) } : {}),
    },
    input.idempotencyKey,
  );

/** Completed Checkout pages paid with this email, newest first (up to 100). https://docs.stripe.com/api/checkout/sessions/list */
export const listCompletedCheckoutSessions = (email: string) =>
  call<{ data: CheckoutSession[] }>("GET", `checkout/sessions?${new URLSearchParams({ "customer_details[email]": email, status: "complete", limit: "100" })}`);

/**
 * Checks a webhook's Stripe-Signature header (HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret, v1 scheme
 * only, 5-minute tolerance). https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !signatures.length || Math.abs(now / 1000 - t) > 300) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  return signatures.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
