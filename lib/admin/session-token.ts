import { createHmac, timingSafeEqual } from "crypto";

/**
 * The owner's session cookie value: "<expiry ms>.<epoch>.<HMAC>". The epoch is the owner's current session epoch
 * (lib/admin/session-epoch.ts): raising it signs out every other device. Cookies from before epochs existed
 * ("<expiry>.<HMAC>") read as epoch 0, so nobody is signed out by the upgrade itself.
 */
const sign = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function createSessionToken(secret: string, epoch: number, maxAgeSec: number, now = Date.now()): string {
  const payload = `${now + maxAgeSec * 1000}.${Math.max(0, Math.trunc(epoch))}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** The session's epoch when the cookie is genuine and unexpired, else null. */
export function readSessionToken(token: string | undefined, secret: string, now = Date.now()): { epoch: number } | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length === 2) {
    const [exp, sig] = parts;
    return Number(exp) >= now && safeEqual(sig, sign(secret, exp)) ? { epoch: 0 } : null;
  }
  if (parts.length === 3) {
    const [exp, epoch, sig] = parts;
    if (!/^\d+$/.test(exp) || !/^\d+$/.test(epoch) || Number(exp) < now) return null;
    return safeEqual(sig, sign(secret, `${exp}.${epoch}`)) ? { epoch: Number(epoch) } : null;
  }
  return null;
}
