import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { site } from "@/config/site";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";

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

export function bookingPayUrl(reference: string, locale: AppLocale = "en"): string | null {
  if (!secret()) return null;
  return `${site.url.replace(/\/$/, "")}${localePath("/pay", locale)}?b=${encodeURIComponent(reference)}&s=${sign(reference)}`;
}

export const verifyPayLink = (reference: string, signature: string) => verify("pay-link:v1", reference, signature);

/** Where the family lands after the deposit page (paid or not): the booking page, showing this booking's status. */
export function depositReturnPath(reference: string, bundleId: string, locale: AppLocale = "en"): string | null {
  if (!secret()) return null;
  return `${localePath("/book", locale)}?${new URLSearchParams({ bundle: bundleId, deposit: reference, k: signFor("deposit-link:v1", reference) })}`;
}

export const verifyDepositLink = (reference: string, signature: string) => verify("deposit-link:v1", reference, signature);

/**
 * A due-date reservation's deposit link ("Not born yet", brief 04): /pay?d=<reference>&k=<signature>. It never expires
 * and opens a Stripe page while the deposit is missing. (Same signature as the retired /due-date/done?r=…&k= link.)
 */
export function duePayPath(reference: string, locale: AppLocale = "en"): string | null {
  if (!secret()) return null;
  return `${localePath("/pay", locale)}?${new URLSearchParams({ d: reference, k: signFor("due-return:v1", reference) })}`;
}

export const verifyDuePay = (reference: string, signature: string) => verify("due-return:v1", reference, signature);

/**
 * The family's photo extras page (owner, Nov 20): /extras?b=<booking reference>&s=<signature>, linked from the
 * sneak-peek email and copied from /admin → Leads. Its own purpose, so a pay link can't open it (or the other way).
 */
export function extrasUrl(reference: string, locale: AppLocale = "en"): string | null {
  if (!secret()) return null;
  return `${site.url.replace(/\/$/, "")}${localePath("/extras", locale)}?b=${encodeURIComponent(reference)}&s=${signFor("extras-link:v1", reference)}`;
}

export const verifyExtrasLink = (reference: string, signature: string) => verify("extras-link:v1", reference, signature);

/**
 * The parent's own copy of their signed photo and video release (owner, Nov 11): /waiver?w=<release id>&s=<signature>,
 * linked from the copy we email when they sign. Signed like the links above (its own purpose), so nobody can open
 * another family's release; it never expires.
 */
export function waiverCopyUrl(id: string): string | null {
  if (!secret()) return null;
  return `${site.url.replace(/\/$/, "")}/waiver?${new URLSearchParams({ w: id, s: signFor("waiver-copy:v1", id) })}`;
}

export function verifyWaiverCopy(id: string, signature: string): boolean {
  if (!secret() || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || !/^[A-Za-z0-9_-]{22}$/.test(signature)) return false;
  const a = Buffer.from(signFor("waiver-copy:v1", id));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
