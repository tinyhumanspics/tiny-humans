import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/payments/server";
import { verifyWebhookSignature } from "@/lib/payments/stripe";
import { log } from "@/lib/log";
import { errorCode, reportFailure } from "@/lib/monitoring/report";

export const dynamic = "force-dynamic";

/** POST: Stripe webhook (checkout.session.completed / async_payment_succeeded). Signature-checked with STRIPE_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  // trimmed: a pasted secret with a trailing space or line break never matches
  if (!verifyWebhookSignature(raw, signature, (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim())) {
    // Signed by Stripe but not with our secret = STRIPE_WEBHOOK_SECRET isn't this endpoint's signing secret (Oct 17:
    // every live delivery failed this way for 10 days, unnoticed, until Stripe disabled the endpoint).
    if (signature) {
      log.warn("payments", "Stripe webhook signature didn't match: check STRIPE_WEBHOOK_SECRET");
      await reportFailure("stripe_webhook", "Webhook signature didn't match: check STRIPE_WEBHOOK_SECRET in Vercel", { severity: "critical" });
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  let event: { id?: string; type?: string } = {};
  try {
    const parsed = JSON.parse(raw);
    event = parsed;
    await handleStripeEvent(parsed);
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 → Stripe retries the delivery later
    log.error("payments", "Webhook handling failed", { error: err as Error });
    await reportFailure("stripe_webhook", `Webhook processing failed (${errorCode(err)}) for ${event.type ?? "an event"}; Stripe will retry`, { severity: "critical", ref: event.id });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
