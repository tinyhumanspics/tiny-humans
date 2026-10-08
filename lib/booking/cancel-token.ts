import "server-only";
import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Customer cancel links: a random 256-bit token per booking. Only its SHA-256
 * hash is stored in Neon, so a database leak can't produce working links, and
 * links can't be guessed or derived from a booking reference.
 */
export function createCancelToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCancelToken(token) };
}

/**
 * The manage token of a booking that is confirmed later (after its deposit is paid, maybe by the Stripe webhook):
 * derived from a server secret and the booking id, so every request that finishes the booking writes the same links.
 * Same shape as a random token; only its hash is stored. Null without ADMIN_SESSION_SECRET.
 */
export function manageTokenFor(bookingId: string): { token: string; hash: string } | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const token = createHmac("sha256", secret).update(`manage-token:v1:${bookingId}`).digest("base64url");
  return { token, hash: hashCancelToken(token) };
}

export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Shape check before any database lookup (43 base64url chars). */
export function looksLikeCancelToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
