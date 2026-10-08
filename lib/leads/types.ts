/** A booking as shown in /admin > Leads (no raw technical ids). */
export type LeadStatus = "pending" | "confirmed" | "rescheduled" | "cancelled";

/** The deposit paid while booking (see lib/db/schema.ts → booking_deposits). */
export interface LeadDeposit {
  amountCents: number;
  status: "pending" | "paid" | "refunded" | "expired" | "unpaid";
  paidAt: string | null;
  refundedAt: string | null;
  /** An automatic refund that failed (refund it by hand). */
  refundError: string | null;
  /** While pending: when the Stripe page expires and the time is released. */
  holdUntil: string | null;
  /** Less than the booking's notice before the session (deposits are normally kept when cancelling now). */
  late: boolean;
  /** The "Your date isn't confirmed yet" email (expired deposits). */
  abandonedEmail: SentEmail | null;
}

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
  /** Not cancelled, so the after-session emails can be sent (also before the session: /admin asks to confirm). */
  canSend: boolean;
  /** The session has started / ended (now vs. the booked times). */
  started: boolean;
  ended: boolean;
  /** The sneak peek email (thank-you + Pixieset gallery to choose favorites). */
  sessionDone: SentEmail | null;
  /** Favorites they can choose: the bundle's edited photos when they booked (e.g. "20"). */
  favorites: string | null;
  gallery: SentEmail | null;
  payment: {
    /** Still owed: bundle + travel fee − a paid deposit. */
    amountCents: number;
    /** What the payment link charges next: an unpaid deposit first (before the session), then the rest. */
    next: { kind: "deposit" | "balance"; amountCents: number };
    status: "unpaid" | "open" | "paid";
    paidAt: string | null;
    /** The booking's payment link (never expires; null if cancelled or nothing to pay). */
    link: string | null;
    /** Last "Email the link". */
    linkEmail: SentEmail | null;
  };
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
  /** Gate code, parking, concierge (from the booking form). */
  access?: string | null;
  /** Backdrop picks (ids) and where they came from ("booking" form or the "family" backdrop page). */
  backdrops?: { picks: string[]; source: string; at: string } | null;
  /** Travel fee charged on top of the bundle and the estimated miles (feeCents null = fees were off). */
  travel?: { feeCents: number | null; miles: number | null };
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
  /** The deposit (null: booked without one; undefined in the prototype). */
  deposit?: LeadDeposit | null;
  /** Emails Resend reported as not delivered (bounced, marked as spam, blocked, failed), newest first. */
  emailProblems?: { kind: "bounced" | "complained" | "suppressed" | "failed"; at: string; email: string; detail: string | null }[];
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
  /** Dashboard money numbers ("all" list only; null if the payments table isn't there). */
  money?: { paidThisMonthCents: number; unpaidCount: number } | null;
}
