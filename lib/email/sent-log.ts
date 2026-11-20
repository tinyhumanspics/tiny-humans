import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, isDatabaseConfigured, isMissingTable } from "@/lib/db/client";
import { sentEmails, type SentEmailRow } from "@/lib/db/schema";
import { log } from "@/lib/log";

/**
 * Every email sent to a family, for their lead in /admin (owner, Nov 20): logged by sendEmail, then Resend's webhook
 * adds whether it was delivered (or bounced, marked as spam, blocked). Best effort: a failed log never stops an email.
 */

/** The family's emails: not the studio's own notifications or the monitoring alerts. */
export const isFamilyEmail = (scope: string) => scope.startsWith("resend.") && !/^resend\.(internal|request_owner)/.test(scope);

export async function logSentEmail(email: { scope: string; to: string; subject: string; reference?: string }, outcome: { resendId: string | null } | { error: string }): Promise<void> {
  if (!email.reference || !isFamilyEmail(email.scope) || !isDatabaseConfigured()) return;
  const sent = "resendId" in outcome;
  try {
    await getDb()
      .insert(sentEmails)
      .values({
        reference: email.reference,
        scope: email.scope,
        recipient: email.to.trim().toLowerCase(),
        subject: email.subject.slice(0, 300),
        status: sent ? "sent" : "failed",
        error: sent ? null : outcome.error.slice(0, 120),
        resendId: sent ? outcome.resendId : null,
      })
      // a retry with the same idempotency key gets the same Resend id: one row
      .onConflictDoNothing();
  } catch (err) {
    if (!isMissingTable(err)) log.error("email.log", "Sent email not logged", { reference: email.reference, error: err as Error });
  }
}

/** Resend's webhook: the email reached the family's inbox (first time only). */
export async function markDelivered(resendId: string, at: Date): Promise<number> {
  const rows = await getDb()
    .update(sentEmails)
    .set({ deliveredAt: at })
    .where(and(eq(sentEmails.resendId, resendId), isNull(sentEmails.deliveredAt)))
    .returning({ id: sentEmails.id });
  return rows.length;
}

/** Resend's webhook: bounced, marked as spam, blocked or failed. */
export async function markProblem(resendId: string, problem: string, detail: string | null, at: Date): Promise<void> {
  await getDb().update(sentEmails).set({ problem, problemDetail: detail, problemAt: at }).where(eq(sentEmails.resendId, resendId));
}

/** The emails about these references (bookings, requests, due-date reservations), newest first. Empty before 0044. */
export async function sentEmailsFor(references: string[]): Promise<SentEmailRow[]> {
  if (!references.length) return [];
  try {
    return await getDb().select().from(sentEmails).where(inArray(sentEmails.reference, references)).orderBy(desc(sentEmails.sentAt));
  } catch (err) {
    if (!isMissingTable(err)) log.error("email.log", "Could not load sent emails", { error: err as Error });
    return [];
  }
}
