import { FEEDBACK_REASONS, FUNNEL_STEPS, isFeedbackReason, type FeedbackReason, type FunnelStep } from "@/config/unfinished";
import type { FunnelSummary, UnfinishedItem, UnfinishedStage } from "./types";

/** Pure helpers for unfinished bookings (no database), unit tested in tests/unit/unfinished.test.ts. */

export const emailKey = (email: string) => email.trim().toLowerCase();

const DEPOSIT_RELEASED = /^Deposit not paid/;

/**
 * Where a saved draft stands. A draft with a booking is hidden ("booked"), unless that booking was released because
 * its deposit was never paid ("deposit"), or it was cancelled later for another reason ("cancelled": that's a
 * cancellation, not an unfinished booking).
 */
export function draftStage(step: string, booking: { status: string; cancellationReason: string | null } | null): UnfinishedStage | "booked" | "cancelled" {
  if (!booking) return step === "review" ? "review" : "details";
  if (booking.status !== "cancelled") return "booked";
  return DEPOSIT_RELEASED.test(booking.cancellationReason ?? "") ? "deposit" : "cancelled";
}

/**
 * Where a draft stands after its family pressed "Reserve" on "Not born yet?" (owner, Nov 11): the reservation is the
 * booking. Waiting on its deposit page = still in progress (hidden, like a booking waiting on its deposit); the page ran
 * out unpaid = "deposit"; cancelled by the owner = "cancelled"; reserved / scheduled = "booked".
 */
export function dueDraftStage(status: string): UnfinishedStage | "booked" | "cancelled" {
  if (status === "expired") return "deposit";
  if (status === "cancelled") return "cancelled";
  return "booked";
}

/** Step counts for the period, in form order, for one source (null = all), plus the sources seen. */
export function funnelSummary(rows: { step: string; source: string; count: number }[], days: number, source: string | null): FunnelSummary {
  const bySource = new Map<string, number>();
  const counts = new Map<FunnelStep, number>(FUNNEL_STEPS.map((step) => [step, 0]));
  for (const row of rows) {
    if (row.step === "calendar") bySource.set(row.source, (bySource.get(row.source) ?? 0) + row.count);
    if (source && row.source !== source) continue;
    const step = FUNNEL_STEPS.find((s) => s === row.step);
    if (step) counts.set(step, (counts.get(step) ?? 0) + row.count);
  }
  return {
    days,
    source,
    steps: FUNNEL_STEPS.map((step) => ({ step, count: counts.get(step) ?? 0 })),
    sources: [...bySource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s),
  };
}

/** How many families picked each reason (a family can pick several), most picked first; reasons nobody picked are left out. */
export function reasonSummary(items: Pick<UnfinishedItem, "feedback">[]): { reasons: { reason: FeedbackReason; count: number }[]; answered: number } {
  const counts = new Map<FeedbackReason, number>();
  let answered = 0;
  for (const item of items) {
    if (!item.feedback) continue;
    answered++;
    for (const reason of new Set(item.feedback.reasons)) if (isFeedbackReason(reason)) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const reasons = FEEDBACK_REASONS.map((reason) => ({ reason, count: counts.get(reason) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return { reasons, answered };
}

/** Who "Send to everyone not contacted yet" emails: never emailed, not unsubscribed. */
export const needsFollowUp = (item: Pick<UnfinishedItem, "followUp" | "unsubscribed">) => !item.followUp && !item.unsubscribed;
