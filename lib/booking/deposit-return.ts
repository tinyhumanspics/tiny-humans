"use client";

/**
 * The booking page this tab is waiting on while the family pays the deposit on Stripe (sessionStorage, this tab only;
 * a signed path, no personal data). Coming back with Back or reopening /book shows that booking's status instead
 * of a fresh form, where their own held time would look taken.
 */
const KEY = "th_deposit_return";
/** A little longer than the hold, so a late payment still shows its confirmation. */
const SLACK_MS = 10 * 60_000;

export function rememberDepositReturn(path: string, holdUntil?: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, until: (holdUntil ? Date.parse(holdUntil) : Date.now() + 30 * 60_000) + SLACK_MS }));
  } catch {
    /* storage unavailable: Stripe's own Back link still returns to the booking page */
  }
}

export function pendingDepositReturn(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { path?: string; until?: number } | null;
    if (v?.path?.startsWith("/book?") && (v.until ?? 0) > Date.now()) return v.path;
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function forgetDepositReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
