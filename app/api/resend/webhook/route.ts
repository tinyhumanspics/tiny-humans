import { NextResponse } from "next/server";
import { handleResendEvent, verifyResendWebhook } from "@/lib/email/delivery";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** POST: Resend webhook (email.bounced / complained / suppressed / failed). Signature-checked with RESEND_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  if (!secret) {
    log.error("email.delivery", "Webhook received but RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const raw = await req.text();
  const id = req.headers.get("svix-id");
  if (!verifyResendWebhook(raw, { id, timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const { saved } = await handleResendEvent(JSON.parse(raw), id!);
    return NextResponse.json({ received: true, saved });
  } catch (err) {
    // 500 → Resend retries the delivery later
    log.error("email.delivery", "Webhook handling failed", { reason: (err as { cause?: { message?: string } }).cause?.message ?? (err as Error).message });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
