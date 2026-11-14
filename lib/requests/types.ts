/**
 * Booking requests (brief 02): the new /book is three screens (when → your details → request sent) and nothing is
 * paid in it. The owner confirms by text; the existing owner booking (48 h hold + pay link) takes over. Client-safe.
 */

export type RequestType = "date" | "due_date";
export type RequestStatus = "new" | "confirmed" | "booked" | "declined" | "expired";

/** A "Baby is here" request keeps its time from other families this long while the owner confirms. */
export const REQUEST_HOLD_HOURS = 12;

/**
 * The text-consent box's wording version. PENDING LEGAL REVIEW (plan/OWNER-ACTIONS.md 10): when the lawyer changes the
 * wording in messages/*.json (bookingRequest.details.consent), bump this so each request records what it agreed to.
 */
export const TEXT_CONSENT_VERSION = "2026-11-14-draft";

/** What the browser sends ("Send request"). */
export interface RequestInput {
  clientId: string;
  locale: "en" | "es";
  type: RequestType;
  bundleId: string;
  babyCount: number;
  slot?: { date: string; start: string };
  dueDate?: string;
  firstName: string;
  mobile: string;
  email: string;
  zip: string;
  textConsent: boolean;
  /** Spam signals (never stored): a hidden box people never see, and how long the form was open. */
  hp?: string;
  elapsedMs?: number;
}

/** What the "Request sent" screen shows. */
export interface RequestSent {
  reference: string;
  firstName: string;
  /** "(305) 555-0142" */
  mobile: string;
  type: RequestType;
  slot?: { date: string; start: string };
  dueDate?: string;
}

/** "3055550142", "+1 (305) 555-0142" → "+13055550142"; null when it isn't a 10-digit US number. */
export function usMobile(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

/** "+13055550142" → "(305) 555-0142" */
export function formatUsMobile(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}
