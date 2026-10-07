import { NextResponse } from "next/server";
import { handleStripeEvent } from "@/lib/payments/server";
import { verifyWebhookSignature } from "@/lib/payments/stripe";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** POST: Stripe webhook (checkout.session.completed / async_payment_succeeded). Signature-checked with STRIPE_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    await handleStripeEvent(JSON.parse(raw));
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 → Stripe retries the delivery later
    log.error("payments", "Webhook handling failed", { error: err as Error });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
