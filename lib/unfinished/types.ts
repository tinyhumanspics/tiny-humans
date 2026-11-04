import type { DraftStep, FeedbackReason, FunnelStep } from "@/config/unfinished";
import type { AppLocale } from "@/i18n/config";

/**
 * How far an unfinished booking got: typing on the details page, the review page, or "deposit" = they pressed
 * "Book my session" but never paid the deposit (that booking was released; it's also under Leads as cancelled).
 */
export type UnfinishedStage = DraftStep | "deposit";

/** One family in /admin → Unfinished bookings. */
export interface UnfinishedItem {
  id: string;
  email: string;
  parentName: string | null;
  phone: string | null;
  bundleName: string | null;
  /** The date and time they had picked (Miami time), if any. */
  sessionDate: string | null;
  start: string | null;
  zip: string | null;
  travelFeeCents: number | null;
  stage: UnfinishedStage;
  locale: AppLocale;
  source: string | null;
  campaign: string | null;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
  /** The released booking's reference when stage = "deposit". */
  reference: string | null;
  followUp: { status: "sending" | "sent" | "failed"; at: string | null; error: string | null } | null;
  unsubscribed: boolean;
  feedback: { reasons: FeedbackReason[]; comment: string | null; at: string } | null;
}

export interface FunnelSummary {
  days: number;
  /** null = every source. */
  source: string | null;
  steps: { step: FunnelStep; count: number }[];
  /** Sources seen in the period, most visits first (for the filter). */
  sources: string[];
}

export interface UnfinishedData {
  /** False until migration 0022 has run in Neon. */
  ready: boolean;
  items: UnfinishedItem[];
  /** Families on the list who booked later (no longer shown). */
  bookedLater: number;
  funnel: FunnelSummary;
  reasons: { reason: FeedbackReason; count: number }[];
  /** How many families answered "What stopped you?". */
  answered: number;
  /** Required in the footer of marketing emails (CAN-SPAM); follow-ups can't be sent without it. */
  mailingAddress: string | null;
}

export interface FollowUpResult {
  data: UnfinishedData;
  sent: number;
  failed: number;
  skipped: number;
}
