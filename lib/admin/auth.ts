/**
 * SERVER ONLY. Owner login: the password (ADMIN_PASSWORD) or a passkey (lib/admin/passkeys.ts), then a signed,
 * httpOnly session cookie (ADMIN_SESSION_SECRET) that carries the owner's session epoch, so "Sign out all other
 * devices" can end every other session without changing the secret (which also signs the families' payment links).
 */
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { currentSessionEpoch } from "./session-epoch";
import { createSessionToken, readSessionToken } from "./session-token";

export const SESSION_COOKIE = "th_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !secret()) return false;
  return safeEqual(input, pw);
}

/**
 * A session cookie value at the owner's current epoch. `signedInAt` keeps an existing session's sign-in time (when
 * a cookie is only re-issued), so re-issuing never makes a session look freshly signed in.
 */
export async function newSessionToken(signedInAt = Date.now()): Promise<string> {
  return createSessionToken(secret()!, await currentSessionEpoch(), SESSION_MAX_AGE, signedInAt);
}

/** Cookie attributes for setting (maxAge = SESSION_MAX_AGE) or clearing (maxAge = 0) the session. */
export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge, priority: "high" as const };
}

/** The owner's live session (null when signed out, expired or signed out from another device). */
async function currentSession(): Promise<{ signedInAt: number } | null> {
  const s = secret();
  if (!s) return null;
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value, s);
  if (!session || session.epoch !== (await currentSessionEpoch())) return null;
  return { signedInAt: session.expiresAt - SESSION_MAX_AGE * 1000 };
}

export async function isAdmin(): Promise<boolean> {
  return (await currentSession()) !== null;
}

/** When the owner's current session signed in (null when not signed in). */
export async function sessionSignedInAt(): Promise<number | null> {
  return (await currentSession())?.signedInAt ?? null;
}

/** How recently the owner must have signed in to add a sign-in device (OWASP: re-authenticate for new credentials). */
export const RECENT_SIGN_IN_MS = 15 * 60_000;

/** Signed in AND within RECENT_SIGN_IN_MS, so a borrowed or stolen session can't quietly add its own passkey. */
export async function signedInRecently(now = Date.now()): Promise<boolean> {
  const session = await currentSession();
  return session !== null && now - session.signedInAt <= RECENT_SIGN_IN_MS;
}
