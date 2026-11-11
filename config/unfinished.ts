/**
 * Unfinished bookings (owner request, Nov 3): families who typed an email on the booking form but didn't book, the
 * "What stopped you?" answers, and anonymous step counts. True constants only; the words live in messages/.
 */

/** Answers on the "What stopped you?" page (stored as these codes). */
export const FEEDBACK_REASONS = ["price", "travel_fee", "dates", "trust", "not_ready", "other_photographer", "other"] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
export const isFeedbackReason = (value: unknown): value is FeedbackReason => FEEDBACK_REASONS.some((reason) => reason === value);

/**
 * Booking form steps counted without names or emails (once per bundle per browser session): the booking form opened
 * ("calendar": its first screen was the calendar until Nov 10, now "About you"; what Meta counts as "InitiateCheckout"),
 * a date picked (time step shown), a time picked (details step shown), the details filled (review step shown), booked.
 */
export const FUNNEL_STEPS = ["calendar", "date", "time", "details", "booked"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export const isFunnelStep = (value: unknown): value is FunnelStep => FUNNEL_STEPS.some((step) => step === value);

/** Which form a draft came from (owner, Nov 11): the booking form, or "Not born yet?" (/due-date). */
export const DRAFT_FORMS = ["booking", "due_date"] as const;
export type DraftForm = (typeof DRAFT_FORMS)[number];

/** How far an unfinished booking got: contact details typed (any step before review), or the review page. */
export const DRAFT_STEPS = ["details", "review"] as const;
export type DraftStep = (typeof DRAFT_STEPS)[number];

export const unfinishedRules = {
  /** A family that booked and comes back to the form after this long starts a new attempt. */
  newAttemptAfterBookedHours: 12,
  /** Contact details from unfinished bookings are deleted after this many days (daily cron). */
  keepDays: 365,
  /** Follow-ups sent per "Send to everyone" click (Resend allows about 2 emails a second). */
  bulkSendLimit: 40,
  /** Limits for what visitors can save. */
  maxNameLength: 120,
  maxCommentLength: 1000,
};
