import type { DraftStep, FunnelStep } from "@/config/unfinished";
import type { AppLocale } from "@/i18n/config";

/**
 * Browser side of unfinished bookings: anonymous step counts and the contact details a family has typed on the booking
 * form (parent contact only: never baby details). Fire and forget: these calls can never slow down or break booking.
 */

const post = (url: string, body: unknown) => {
  try {
    void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => undefined);
  } catch {
    /* old browsers without keepalive: skip */
  }
};

/** Once per step and bundle per browser session (going back and forth doesn't count twice). */
function firstTime(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked (private mode): count anyway */
  }
  return true;
}

export function countBookingStep(step: FunnelStep, bundleId: string) {
  if (firstTime(`th_funnel_${step}_${bundleId}`)) post("/api/booking/funnel", { step, bundleId });
}

export interface DraftPayload {
  email: string;
  parentName?: string;
  phone?: string;
  bundleId: string;
  date?: string;
  start?: string;
  zip?: string;
  step: DraftStep;
  locale: AppLocale;
  /** "Not born yet?" (/due-date); left out on the booking form. */
  form?: "due_date";
  /** An email saved earlier on this form that they then corrected (the typo'd one is removed). */
  replaces?: string;
}

export const saveBookingDraft = (draft: DraftPayload) => post("/api/booking/draft", draft);

/** Close to the server's email check, so half-typed addresses aren't sent. */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(value);
