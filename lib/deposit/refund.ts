import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingDeposits, type Booking } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { createRefund, StripeError } from "@/lib/payments/stripe";
import { dbReason, depositOf } from "./server";

/** What happened to a paid deposit when its booking was cancelled (for the emails and /admin). */
export interface DepositOutcome {
  amountCents: number;
  result: "refunded" | "kept" | "refund_failed";
  /** Stripe's reason when the refund failed. */
  error?: string;
}

/**
 * Refunds a booking's paid deposit in full (Stripe Refunds API, needs "Refunds: Write"). Null when there's no paid
 * deposit. Never throws: a failed refund is saved on the deposit (refund it in Stripe) and reported.
 */
export async function refundDeposit(row: Booking): Promise<DepositOutcome | null> {
  const d = await depositOf(row.id);
  if (d?.status !== "paid") return null;
  const db = getDb();
  const failed = async (code: string): Promise<DepositOutcome> => {
    log.error("deposit", "Deposit refund failed: refund it in Stripe", { reference: row.bookingReference, code });
    await db
      .update(bookingDeposits)
      .set({ refundError: code.slice(0, 120), updatedAt: new Date() })
      .where(eq(bookingDeposits.bookingId, row.id))
      .catch((err) => log.error("deposit", "Refund failure not saved", { reference: row.bookingReference, error: dbReason(err) }));
    return { amountCents: d.amountCents, result: "refund_failed", error: code };
  };
  if (!d.stripePaymentIntent) return failed("no_payment_intent");
  try {
    const refund = await createRefund({ paymentIntent: d.stripePaymentIntent, reference: row.bookingReference, idempotencyKey: `deposit-refund/${row.id}` });
    if (refund.status === "failed" || refund.status === "canceled") return failed(refund.failure_reason ?? refund.status);
    const now = new Date();
    await db
      .update(bookingDeposits)
      .set({ status: "refunded", refundId: refund.id, refundedAt: now, refundError: null, updatedAt: now })
      .where(and(eq(bookingDeposits.bookingId, row.id), eq(bookingDeposits.status, "paid")))
      .catch((err) => log.error("deposit", "Refund made in Stripe but not saved here", { reference: row.bookingReference, error: dbReason(err) }));
    log.info("deposit", "Deposit refunded", { reference: row.bookingReference, status: refund.status });
    return { amountCents: d.amountCents, result: "refunded" };
  } catch (err) {
    return failed(err instanceof StripeError ? err.code : "refund_error");
  }
}

/** On cancellation: refund the paid deposit, or note that it's kept. Null: no paid deposit. Never throws. */
export async function settleDepositOnCancel(row: Booking, refund: boolean): Promise<DepositOutcome | null> {
  if (refund) return refundDeposit(row);
  const d = await depositOf(row.id);
  return d?.status === "paid" ? { amountCents: d.amountCents, result: "kept" } : null;
}
