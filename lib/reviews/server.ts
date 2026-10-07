import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { reviews, type Booking, type Review } from "@/lib/db/schema";
import { AFTER_KINDS, findByEmailLink } from "@/lib/booking/after-session";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { internalNewReviewEmail } from "@/lib/email";
import { log } from "@/lib/log";

/** Reviews families send from the link in the gallery email; kept per booking, picked for the website in /admin. */
export interface ReviewInput {
  rating: number;
  body: string;
  displayName: string;
  consentPublic: boolean;
}

/** "Ana Muñoz" → "Ana M." */
export const suggestedName = (parentName: string) => {
  const [first, ...rest] = parentName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

async function bookingFor(token: string): Promise<Booking | null> {
  const row = await findByEmailLink(token, [AFTER_KINDS.gallery]);
  return row && row.status !== "cancelled" ? row : null;
}

export async function getReviewForm(token: string) {
  const row = await bookingFor(token);
  if (!row) return null;
  const [existing] = await getDb().select().from(reviews).where(eq(reviews.bookingId, row.id)).limit(1);
  return {
    firstName: row.parentName.split(" ")[0],
    suggestedName: suggestedName(row.parentName),
    review: existing ? { rating: existing.rating, body: existing.body, displayName: existing.displayName, consentPublic: existing.consentPublic } : null,
  };
}

/** Saves (or updates) the family's review, then tells the studio. Returns false for an unknown link. */
export async function saveReview(token: string, input: ReviewInput): Promise<boolean> {
  const row = await bookingFor(token);
  if (!row) return false;
  const db = getDb();
  const [before] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, row.id)).limit(1);
  const now = new Date();
  await db
    .insert(reviews)
    .values({ bookingId: row.id, ...input })
    // without the family's OK the owner can't keep it picked for the website
    .onConflictDoUpdate({ target: reviews.bookingId, set: { ...input, ...(input.consentPublic ? {} : { approved: false }), updatedAt: now } });
  log.info("reviews", before ? "Review updated" : "Review received", { reference: row.bookingReference });
  try {
    const mail = await internalNewReviewEmail({ reference: row.bookingReference, parentName: row.parentName, email: row.email, ...input, updated: Boolean(before) });
    const cfg = emailConfig();
    await sendEmail({ scope: "resend.internal-review", from: cfg.internalFrom, to: cfg.notify, subject: mail.subject, html: mail.html, text: mail.text, replyTo: row.email, reference: row.bookingReference });
  } catch (err) {
    log.warn("reviews", "Studio notification not sent (review saved)", { reference: row.bookingReference, error: err as Error });
  }
  return true;
}

export async function reviewsFor(bookingIds: string[]): Promise<Review[]> {
  if (!bookingIds.length) return [];
  return getDb().select().from(reviews).where(inArray(reviews.bookingId, bookingIds));
}

/** Owner's pick for the website; only possible when the family said OK. */
export async function setReviewApproved(bookingId: string, approved: boolean): Promise<boolean> {
  const [r] = await getDb().select().from(reviews).where(eq(reviews.bookingId, bookingId)).limit(1);
  if (!r || (approved && !r.consentPublic)) return false;
  await getDb().update(reviews).set({ approved, updatedAt: new Date() }).where(eq(reviews.bookingId, bookingId));
  return true;
}
