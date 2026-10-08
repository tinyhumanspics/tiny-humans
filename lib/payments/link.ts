import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { site } from "@/config/site";

/**
 * Each booking's payment link: /pay?b=<booking reference>&s=<signature>. It never expires and is the same every time,
 * so the owner can text, copy or email it before or after the session. The signature (HMAC with
 * ADMIN_SESSION_SECRET, a separate "pay-link" purpose) means nobody can make one for another booking. Opening it
 * makes (or reuses) a Stripe Checkout page for the booked amount.
 *
 * The deposit's way back from Stripe (/book?bundle=…&deposit=<reference>&k=<signature>) is signed the same way with
 * its own purpose, so one link can't be used as the other.
 */
const secret = () => process.env.ADMIN_SESSION_SECRET ?? "";
const signFor = (purpose: string, reference: string) => createHmac("sha256", secret()).update(`${purpose}:${reference}`).digest("base64url").slice(0, 22);
const sign = (reference: string) => signFor("pay-link:v1", reference);

function verify(purpose: string, reference: string, signature: string): boolean {
  if (!secret() || !/^TH-[0-9A-Z-]{4,32}$/.test(reference) || !/^[A-Za-z0-9_-]{22}$/.test(signature)) return false;
  const a = Buffer.from(signFor(purpose, reference));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bookingPayUrl(reference: string): string | null {
  if (!secret()) return null;
  return `${site.url.replace(/\/$/, "")}/pay?b=${encodeURIComponent(reference)}&s=${sign(reference)}`;
}

export const verifyPayLink = (reference: string, signature: string) => verify("pay-link:v1", reference, signature);

/** Where the family lands after the deposit page (paid or not): the booking page, showing this booking's status. */
export function depositReturnPath(reference: string, bundleId: string): string | null {
  if (!secret()) return null;
  return `/book?${new URLSearchParams({ bundle: bundleId, deposit: reference, k: signFor("deposit-link:v1", reference) })}`;
}

export const verifyDepositLink = (reference: string, signature: string) => verify("deposit-link:v1", reference, signature);
