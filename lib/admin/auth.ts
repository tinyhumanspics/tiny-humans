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

/** A new session cookie value at the owner's current epoch. */
export async function newSessionToken(): Promise<string> {
  return createSessionToken(secret()!, await currentSessionEpoch(), SESSION_MAX_AGE);
}

/** Cookie attributes for setting (maxAge = SESSION_MAX_AGE) or clearing (maxAge = 0) the session. */
export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge, priority: "high" as const };
}

export async function isAdmin(): Promise<boolean> {
  const s = secret();
  if (!s) return false;
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value, s);
  return session !== null && session.epoch === (await currentSessionEpoch());
}
