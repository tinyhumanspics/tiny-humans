import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { site } from "@/config/site";

/**
 * Each booking's payment link: /pay?b=<booking reference>&s=<signature>. It never expires and is the same every time,
 * so the owner can text, copy or email it before or after the session. The signature (HMAC with
 * ADMIN_SESSION_SECRET, a separate "pay-link" purpose) means nobody can make one for another booking. Opening it
 * makes (or reuses) a Stripe Checkout page for the booked amount.
 */
const secret = () => process.env.ADMIN_SESSION_SECRET ?? "";
const sign = (reference: string) => createHmac("sha256", secret()).update(`pay-link:v1:${reference}`).digest("base64url").slice(0, 22);

export function bookingPayUrl(reference: string): string | null {
  if (!secret()) return null;
  return `${site.url.replace(/\/$/, "")}/pay?b=${encodeURIComponent(reference)}&s=${sign(reference)}`;
}

export function verifyPayLink(reference: string, signature: string): boolean {
  if (!secret() || !/^TH-[0-9A-Z-]{4,32}$/.test(reference) || !/^[A-Za-z0-9_-]{22}$/.test(signature)) return false;
  const a = Buffer.from(sign(reference));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
