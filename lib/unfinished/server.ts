import "server-only";
import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { bookingRules, scheduleHref } from "@/config/booking";
import { site } from "@/config/site";
import { unfinishedRules, type DraftStep, type FeedbackReason, type FunnelStep } from "@/config/unfinished";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import { BookingError } from "@/lib/booking/errors";
import { createCancelToken, hashCancelToken, looksLikeCancelToken } from "@/lib/booking/cancel-token";
import { addDaysKey, todayInZone } from "@/lib/booking/timezone";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { bookingDrafts, bookings, emailUnsubscribes, funnelCounts, marketingSettings, type BookingDraft } from "@/lib/db/schema";
import { isMissingTable } from "@/lib/deposit/server";
import { unfinishedFollowUpEmail } from "@/lib/email";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { getCatalog, getPublicCatalog } from "@/lib/pricing/server";
import { getSiteSettings } from "@/lib/settings/server";
import { decodeAttribution, sourceLabel } from "@/lib/tracking/attribution";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import { draftStage, emailKey, funnelSummary, mergeDraft, needsFollowUp, reasonSummary } from "./summary";
import type { FollowUpResult, UnfinishedData, UnfinishedItem } from "./types";

/**
 * Unfinished bookings (owner request, Nov 3): contact details typed on the booking form by families who didn't book,
 * one "What stopped you?" email the owner sends from /admin, the family's answer, unsubscribes and anonymous step
 * counts. Saving is best effort: a missing table (migration 0022 not run) or a database error never reaches the
 * family's booking form. Never stores baby details.
 */

const base = () => site.url.replace(/\/$/, "");
const warned = new Set<string>();
/** Missing tables are expected until migration 0022 runs: say so once per server instance, then stay quiet. */
function skipIfMissing(err: unknown, scope: string): void {
  if (isMissingTable(err)) {
    if (!warned.has(scope)) log.warn(scope, "Unfinished-booking tables not found: run drizzle/0022_unfinished_bookings.sql in Neon");
    warned.add(scope);
    return;
  }
  log.error(scope, "Unfinished-booking save failed", { error: err as Error });
}

export interface DraftInput {
  email: string;
  parentName?: string;
  phone?: string;
  bundleId: string;
  date?: string;
  start?: string;
  zip?: string;
  step: DraftStep;
  locale: AppLocale;
  /** An email saved a moment ago on the same form that they then corrected: removed if it's still fresh. */
  replaces?: string;
}

/** Saves what the family has typed so far (POST /api/booking/draft). Best effort: never throws. */
export async function saveDraft(input: DraftInput, sourceCookie: string | undefined, now = new Date()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const key = emailKey(input.email);
    const [bundle, travel] = await Promise.all([
      getCatalog().then((all) => all.find((b) => b.id === input.bundleId) ?? null).catch(() => null),
      input.zip ? getTravelSettings().then((s) => travelQuote(input.zip!, s)).catch(() => null) : Promise.resolve(null),
    ]);
    const attribution = decodeAttribution(sourceCookie);
    const fields = {
      email: input.email.trim(),
      parentName: input.parentName?.trim() || null,
      phone: input.phone?.trim() || null,
      bundleId: bundle?.id ?? null,
      bundleName: bundle?.name ?? null,
      sessionDate: input.date ?? null,
      startTime: input.start ?? null,
      zip: input.zip ?? null,
      travelFeeCents: travel && travel.status === "fee" ? travel.feeCents : travel ? 0 : null,
      locale: input.locale,
      updatedAt: now,
    };
    const db = getDb();
    if (input.replaces && emailKey(input.replaces) !== key) {
      // a typo they fixed on the same form: never touch a family that booked, was emailed, or isn't from the last 2 hours
      await db
        .delete(bookingDrafts)
        .where(and(eq(bookingDrafts.emailKey, emailKey(input.replaces)), isNull(bookingDrafts.bookedReference), isNull(bookingDrafts.followUpStatus), gte(bookingDrafts.createdAt, new Date(now.getTime() - 2 * 3_600_000))));
    }
    const [existing] = await db.select().from(bookingDrafts).where(eq(bookingDrafts.emailKey, key)).limit(1);
    if (!existing) {
      await db
        .insert(bookingDrafts)
        .values({ ...fields, emailKey: key, step: input.step, source: attribution ? sourceLabel(attribution) : null, campaign: attribution?.utmCampaign ?? null, createdAt: now })
        // two saves at once (typing fast): the second one just updates
        .onConflictDoUpdate({ target: bookingDrafts.emailKey, set: { ...fields } });
      return;
    }
    const merge = mergeDraft(existing, { step: input.step, at: now });
    if (merge.action === "ignore") return;
    await db
      .update(bookingDrafts)
      .set({
        ...fields,
        // keep what they typed earlier if this save left a box empty
        parentName: fields.parentName ?? existing.parentName,
        phone: fields.phone ?? existing.phone,
        step: merge.step,
        attempts: merge.attempts,
        ...(merge.clearBooking ? { bookedReference: null, bookedAt: null } : {}),
        source: existing.source ?? (attribution ? sourceLabel(attribution) : null),
        campaign: existing.campaign ?? attribution?.utmCampaign ?? null,
      })
      .where(eq(bookingDrafts.id, existing.id));
  } catch (err) {
    skipIfMissing(err, "unfinished.save");
  }
}

/** After a booking is created (also one waiting on its deposit): this email's draft is "booked". Best effort. */
export async function markDraftBooked(email: string, reference: string, now = new Date()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await getDb().update(bookingDrafts).set({ bookedReference: reference, bookedAt: now }).where(eq(bookingDrafts.emailKey, emailKey(email)));
  } catch (err) {
    skipIfMissing(err, "unfinished.booked");
  }
}

/** +1 for a booking-form step (POST /api/booking/funnel). No names, emails, IPs or ids. Best effort. */
export async function countFunnelStep(step: FunnelStep, bundleId: string, sourceCookie: string | undefined, now = new Date()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const attribution = decodeAttribution(sourceCookie);
    const bundle = (await getCatalog().catch(() => [])).find((b) => b.id === bundleId);
    await getDb()
      .insert(funnelCounts)
      .values({ day: todayInZone(bookingRules.timeZone, now), step, bundleId: bundle ? bundle.id : "other", source: sourceLabel(attribution).slice(0, 80), count: 1 })
      .onConflictDoUpdate({ target: [funnelCounts.day, funnelCounts.step, funnelCounts.bundleId, funnelCounts.source], set: { count: sql`${funnelCounts.count} + 1` } });
  } catch (err) {
    skipIfMissing(err, "unfinished.funnel");
  }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function loadItems(): Promise<{ items: UnfinishedItem[]; bookedLater: number }> {
  const rows = await getDb()
    .select({ draft: bookingDrafts, status: bookings.status, cancellationReason: bookings.cancellationReason, unsubscribed: emailUnsubscribes.emailKey })
    .from(bookingDrafts)
    .leftJoin(bookings, eq(bookings.bookingReference, bookingDrafts.bookedReference))
    .leftJoin(emailUnsubscribes, eq(emailUnsubscribes.emailKey, bookingDrafts.emailKey))
    .orderBy(desc(bookingDrafts.updatedAt))
    .limit(1000);
  const items: UnfinishedItem[] = [];
  let bookedLater = 0;
  for (const { draft: d, status, cancellationReason, unsubscribed } of rows) {
    const stage = draftStage(d.step, d.bookedReference && status ? { status, cancellationReason } : null);
    if (stage === "booked") bookedLater++;
    if (stage === "booked" || stage === "cancelled") continue;
    items.push({
      id: d.id,
      email: d.email,
      parentName: d.parentName,
      phone: d.phone,
      bundleName: d.bundleName,
      sessionDate: d.sessionDate,
      start: d.startTime,
      zip: d.zip,
      travelFeeCents: d.travelFeeCents,
      stage,
      locale: d.locale === "es" ? "es" : "en",
      source: d.source,
      campaign: d.campaign,
      attempts: d.attempts,
      firstSeen: d.createdAt.toISOString(),
      lastSeen: d.updatedAt.toISOString(),
      reference: stage === "deposit" ? d.bookedReference : null,
      followUp: d.followUpStatus ? { status: d.followUpStatus as "sending" | "sent" | "failed", at: iso(d.followUpSentAt), error: d.followUpError } : null,
      unsubscribed: Boolean(unsubscribed),
      feedback: d.feedbackAt ? { reasons: (d.feedbackReasons ?? []) as FeedbackReason[], comment: d.feedbackComment, at: d.feedbackAt.toISOString() } : null,
    });
  }
  return { items, bookedLater };
}

export async function getMailingAddress(): Promise<string | null> {
  const [row] = await getDb().select({ address: marketingSettings.mailingAddress }).from(marketingSettings).where(eq(marketingSettings.id, 1)).limit(1);
  return row?.address?.trim() || null;
}

export async function saveMailingAddress(address: string): Promise<void> {
  const value = address.trim() || null;
  await getDb()
    .insert(marketingSettings)
    .values({ id: 1, mailingAddress: value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: marketingSettings.id, set: { mailingAddress: value, updatedAt: new Date() } });
}

const EMPTY = (days: number, source: string | null): UnfinishedData => ({
  ready: false,
  items: [],
  bookedLater: 0,
  funnel: funnelSummary([], days, source),
  reasons: [],
  answered: 0,
  mailingAddress: null,
});

/** Everything /admin → Unfinished bookings shows. `ready: false` until migration 0022 has run. */
export async function getUnfinishedData(days: number, source: string | null, now = new Date()): Promise<UnfinishedData> {
  try {
    const since = addDaysKey(todayInZone(bookingRules.timeZone, now), -(days - 1));
    const [{ items, bookedLater }, funnelRows, mailingAddress] = await Promise.all([
      loadItems(),
      getDb().select({ step: funnelCounts.step, source: funnelCounts.source, count: funnelCounts.count }).from(funnelCounts).where(gte(funnelCounts.day, since)),
      getMailingAddress(),
    ]);
    const { reasons, answered } = reasonSummary(items);
    return { ready: true, items, bookedLater, funnel: funnelSummary(funnelRows, days, source), reasons, answered, mailingAddress };
  } catch (err) {
    if (isMissingTable(err)) return EMPTY(days, source);
    throw err;
  }
}

export async function deleteDraft(id: string): Promise<void> {
  await getDb().delete(bookingDrafts).where(eq(bookingDrafts.id, id));
}

const feedbackUrl = (token: string, locale: AppLocale) => `${base()}${localePath("/feedback", locale)}?t=${token}`;
const unsubscribeUrl = (token: string, locale: AppLocale) => `${base()}${localePath("/unsubscribe", locale)}?t=${token}`;
/** RFC 8058 one-click unsubscribe (Gmail/Yahoo bulk-sender rules): mail apps POST here. */
const oneClickUrl = (token: string) => `${base()}/api/unsubscribe?t=${token}`;

/** Sends the "What stopped you?" email to one family. Throws BookingError with a message for the owner. */
export async function sendFollowUp(id: string): Promise<void> {
  const address = await getMailingAddress();
  if (!address) throw new BookingError("invalid_request", "Add your mailing address first: the law requires it at the bottom of marketing emails.");
  const { items } = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) throw new BookingError("not_found", "This family isn't on the list anymore (they may have booked).");
  if (item.unsubscribed) throw new BookingError("invalid_request", "They unsubscribed from marketing emails.");
  const token = createCancelToken();
  const db = getDb();
  const [claimed] = await db
    .update(bookingDrafts)
    .set({ followUpStatus: "sending", followUpAttempts: sql`${bookingDrafts.followUpAttempts} + 1`, followUpError: null, linkTokenHash: token.hash })
    .where(and(eq(bookingDrafts.id, id), or(isNull(bookingDrafts.followUpStatus), eq(bookingDrafts.followUpStatus, "failed"))))
    .returning({ attempts: bookingDrafts.followUpAttempts, bundleId: bookingDrafts.bundleId });
  if (!claimed) throw new BookingError("invalid_request", "This email was already sent.");
  try {
    const [themeId, bundleName] = await Promise.all([
      getSiteSettings().then((s) => s.themeId).catch(() => "default"),
      // the bundle's name in the family's language (the saved one is English)
      getPublicCatalog(item.locale)
        .then((c) => c.bundles.find((b) => b.id === claimed.bundleId)?.name ?? item.bundleName)
        .catch(() => (item.locale === "en" ? item.bundleName : null)),
    ]);
    const mail = await unfinishedFollowUpEmail(
      { parentName: item.parentName ?? "", bundleName },
      {
        themeId,
        locale: item.locale,
        feedbackUrl: feedbackUrl(token.token, item.locale),
        bookUrl: `${base()}${claimed.bundleId ? scheduleHref(claimed.bundleId, null, item.locale) : localePath("/bundles", item.locale)}`,
        unsubscribeUrl: unsubscribeUrl(token.token, item.locale),
        mailingAddress: address,
      },
    );
    const { id: resendId } = await sendEmail({
      scope: "resend.unfinished_followup",
      to: item.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `unfinished_followup/${id}/${claimed.attempts}`,
      headers: { "List-Unsubscribe": `<${oneClickUrl(token.token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    await db.update(bookingDrafts).set({ followUpStatus: "sent", followUpResendId: resendId, followUpSentAt: new Date() }).where(eq(bookingDrafts.id, id));
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("unfinished.followup", "Follow-up email not sent", { code, error: err instanceof EmailSendError ? undefined : (err as Error) });
    await db.update(bookingDrafts).set({ followUpStatus: "failed", followUpError: code }).where(eq(bookingDrafts.id, id)).catch(() => undefined);
    throw new BookingError("server_error", `The email wasn't sent (${code}). Please try again.`);
  }
}

/** "Send to everyone not contacted yet": up to bulkSendLimit families per click, one at a time. */
export async function sendFollowUpToAll(): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!(await getMailingAddress())) throw new BookingError("invalid_request", "Add your mailing address first: the law requires it at the bottom of marketing emails.");
  const waiting = (await loadItems()).items.filter(needsFollowUp);
  const batch = waiting.slice(0, unfinishedRules.bulkSendLimit);
  let sent = 0;
  let failed = 0;
  for (const [i, item] of batch.entries()) {
    if (i) await new Promise((resolve) => setTimeout(resolve, 600)); // Resend: about 2 emails a second
    try {
      await sendFollowUp(item.id);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed, skipped: waiting.length - batch.length };
}

export async function followUpAndReload(target: { id: string } | { all: true }, days: number, source: string | null): Promise<FollowUpResult> {
  let result = { sent: 0, failed: 0, skipped: 0 };
  if ("id" in target) {
    await sendFollowUp(target.id);
    result = { sent: 1, failed: 0, skipped: 0 };
  } else result = await sendFollowUpToAll();
  return { ...result, data: await getUnfinishedData(days, source) };
}

async function draftByToken(token: string): Promise<BookingDraft | null> {
  if (!looksLikeCancelToken(token)) return null;
  const [row] = await getDb().select().from(bookingDrafts).where(eq(bookingDrafts.linkTokenHash, hashCancelToken(token))).limit(1);
  return row ?? null;
}

/** /feedback?t=…: first name + any earlier answer. */
export async function getFeedbackForm(token: string): Promise<{ firstName: string; reasons: FeedbackReason[]; comment: string } | null> {
  const row = await draftByToken(token);
  if (!row) return null;
  return { firstName: (row.parentName ?? "").split(" ")[0] ?? "", reasons: (row.feedbackReasons ?? []) as FeedbackReason[], comment: row.feedbackComment ?? "" };
}

export async function saveFeedback(token: string, reasons: FeedbackReason[], comment: string): Promise<boolean> {
  const row = await draftByToken(token);
  if (!row) return false;
  await getDb()
    .update(bookingDrafts)
    .set({ feedbackReasons: [...new Set(reasons)], feedbackComment: comment.trim() || null, feedbackAt: new Date() })
    .where(eq(bookingDrafts.id, row.id));
  return true;
}

/** /unsubscribe and the one-click header: no more marketing emails to this address. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const row = await draftByToken(token);
  if (!row) return false;
  await getDb().insert(emailUnsubscribes).values({ emailKey: row.emailKey }).onConflictDoNothing();
  return true;
}

/** Daily cron: contact details from unfinished bookings are kept unfinishedRules.keepDays (Privacy Policy), then deleted. */
export async function purgeOldDrafts(now = new Date()): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const cutoff = new Date(now.getTime() - unfinishedRules.keepDays * 86_400_000);
    const gone = await getDb().delete(bookingDrafts).where(lt(bookingDrafts.updatedAt, cutoff)).returning({ id: bookingDrafts.id });
    return gone.length;
  } catch (err) {
    skipIfMissing(err, "unfinished.purge");
    return 0;
  }
}
