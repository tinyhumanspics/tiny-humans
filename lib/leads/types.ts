/** A booking as shown in /admin > Leads (no raw technical ids). */
export type LeadStatus = "pending" | "confirmed" | "rescheduled" | "cancelled";

export interface EmailStatus {
  sent: boolean;
  at: string | null;
  error: string | null;
}

export interface SentEmail {
  status: "sending" | "sent" | "failed";
  at: string | null;
  error: string | null;
}

/** After the session: what the owner has sent, what the family paid, and their review. */
export interface AfterSessionStatus {
  /** The session has started and isn't cancelled, so the after-session emails can be sent. */
  canSend: boolean;
  sessionDone: SentEmail | null;
  gallery: SentEmail | null;
  payment: { amountCents: number; status: "unpaid" | "open" | "paid"; paidAt: string | null };
  review: { rating: number; body: string; displayName: string; consentPublic: boolean; approved: boolean; at: string } | null;
}

export interface Lead {
  reference: string;
  status: LeadStatus;
  parentName: string;
  email: string;
  phone: string;
  babyName: string | null;
  babyAge: string;
  bundleId: string;
  bundleName: string;
  /** Price snapshot from booking time (never recalculated). */
  pricing: { regularCents: number; offerCents: number | null; offerLabel: string | null; discountCode: string | null; discountCents: number; finalCents: number; pricingType: "regular" | "offer" | "discount" };
  sessionDate: string;
  /** "HH:MM" local */
  start: string;
  end: string;
  locationType: string;
  address: string;
  notes: string | null;
  inspirationPhotoId: string | null;
  calendarLinked: boolean;
  confirmationEmail: EmailStatus;
  internalNotification: EmailStatus;
  /** Oldest first. Empty if never rescheduled. */
  history: { oldDate: string; oldStart: string; newDate: string; newStart: string; newEnd: string; by: "customer" | "admin"; at: string }[];
  /** Reminder emails for the current session time (none yet = empty). */
  reminders?: { kind: "72h" | "24h"; status: "sending" | "sent" | "failed"; at: string | null; error: string | null }[];
  /** After-session emails, payment and review (server mode only). */
  after?: AfterSessionStatus;
  /** Optional permissions from the booking form, with when each was given (server mode only). */
  consents?: { sms: boolean; smsAt: string | null; photos: boolean; photosAt: string | null };
  cancellation: { reason: string | null; at: string | null; by: "customer" | "admin" | null; email: EmailStatus; internal: EmailStatus } | null;
  /** Where the family came from (first touch). null for bookings made before source tracking. */
  source: { label: string; campaign: string | null; medium: string | null; content: string | null; term: string | null; landingPath: string | null; referrer: string | null; metaClick: boolean; at: string | null } | null;
  createdAt: string;
}

export type LeadFilter = "all" | LeadStatus;

export interface LeadList {
  leads: Lead[];
  /** Counts across ALL leads (not just this page). */
  counts: Record<LeadFilter, number>;
  total: number;
}
