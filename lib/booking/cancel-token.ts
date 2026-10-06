import "server-only";
import { createHash, randomBytes } from "crypto";

/**
 * Customer cancel links: a random 256-bit token per booking. Only its SHA-256
 * hash is stored in Neon, so a database leak can't produce working links, and
 * links can't be guessed or derived from a booking reference.
 */
export function createCancelToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCancelToken(token) };
}

export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Shape check before any database lookup (43 base64url chars). */
export function looksLikeCancelToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
