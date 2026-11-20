/**
 * Booking requests (brief 02): the new /book is three screens (when → your details → request sent) and nothing is
 * paid in it. The owner confirms by text; the existing owner booking (48 h hold + pay link) takes over. Client-safe.
 */

export type RequestType = "date" | "due_date";
export type RequestStatus = "new" | "confirmed" | "booked" | "declined" | "expired";

/** A "Baby is here" request keeps its time from other families this long while the owner confirms. */
export const REQUEST_HOLD_HOURS = 12;

/**
 * The text-consent box's wording version (messages/*.json → bookingRequest.details.consent). Approved by the owner on
 * Nov 14, 2026 (no lawyer review). When the wording changes, change this too, so each request records what it agreed to.
 */
export const TEXT_CONSENT_VERSION = "2026-11-14";

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

/** Close to the server's email check (the request form's inline error). */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(value);

/** "+13055550142" → "(305) 555-0142" */
export function formatUsMobile(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/** One request on /admin → Requests (GET /api/admin/requests). */
export interface RequestListItem {
  id: string;
  reference: string;
  createdAt: string;
  locale: "en" | "es";
  type: RequestType;
  status: RequestStatus;
  bundleId: string;
  bundleName: string;
  babyCount: number;
  /** Bundle + extra babies, without travel (cents). */
  totalCents: number;
  travelStatus: string | null;
  travelMiles: number | null;
  travelFeeCents: number;
  slotDate: string | null;
  slotStart: string | null;
  dueDate: string | null;
  holdUntil: string | null;
  firstName: string;
  /** "(305) 555-0142" */
  mobile: string;
  email: string;
  zip: string;
  textConsent: boolean;
  /** The booking (with its day and start time: "Other time" may differ from the request) or due-date reservation made from it. */
  made: { reference: string; date?: string; start?: string } | null;
  /** The "Text" button's message, in their language. */
  hello: string;
  /** Sent from your booking link (owner, Nov 19): how they reached you and their babies; null = the website. */
  link: { source: string; babies: { age: string; name?: string }[] } | null;
}

/** What "Confirm & send pay link" (or "Other time") returns. */
export interface RequestConfirmed {
  /** The booking's or the due-date reservation's reference. */
  reference: string;
  kind: "booking" | "due";
  /** pending = waiting on the deposit (the request is "confirmed"); done = nothing to pay (the request is "booked"). */
  status: "pending" | "done";
  /** The family's pay link (null when there's nothing to pay). */
  url: string | null;
  holdUntil: string | null;
  /** The text to send them (the sms: body), in their language. */
  sms: string;
  emailed: boolean;
  emailError?: string;
}
