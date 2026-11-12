"use client";

/**
 * The "Not born yet" reservation this tab is paying for (owner, Nov 11): Back from Stripe (or reopening /due-date)
 * shows their reservation page with "Pay the deposit", not an empty form. sessionStorage, this tab only; a signed path,
 * no personal data. Like lib/booking/deposit-return.ts for bookings.
 */
const KEY = "th_due_return";
const TTL_MS = 3 * 3600_000;

export function rememberDueReturn(path: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, until: Date.now() + TTL_MS }));
  } catch {
    /* storage unavailable: Stripe's own back link still returns to the reservation page */
  }
}

export function pendingDueReturn(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { path?: string; until?: number } | null;
    if (v?.path && /^(\/es)?\/due-date\/done\?/.test(v.path) && (v.until ?? 0) > Date.now()) return v.path;
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return null;
}

export function forgetDueReturn() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
