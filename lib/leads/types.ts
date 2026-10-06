/** A booking as shown in /admin > Leads (no raw technical ids). */
export type LeadStatus = "pending" | "confirmed" | "rescheduled" | "cancelled";

export interface EmailStatus {
  sent: boolean;
  at: string | null;
  error: string | null;
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
  cancellation: { reason: string | null; at: string | null; by: "customer" | "admin" | null; email: EmailStatus; internal: EmailStatus } | null;
  createdAt: string;
}

export type LeadFilter = "all" | LeadStatus;

export interface LeadList {
  leads: Lead[];
  /** Counts across ALL leads (not just this page). */
  counts: Record<LeadFilter, number>;
  total: number;
}
