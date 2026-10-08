import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { site } from "@/config/site";
import { getDb } from "@/lib/db/client";
import { bookingEmails, bookingPayments, bookings, type Booking, type BookingDeposit } from "@/lib/db/schema";
import { EmailSendError, emailConfig, sendEmail } from "@/lib/email/resend";
import { galleryDeliveredEmail, paymentLinkEmail, sneakPeekEmail } from "@/lib/email";
import { bookingPayUrl } from "@/lib/payments/link";
import { getSiteSettings } from "@/lib/settings/server";
import { log } from "@/lib/log";
import { BookingError } from "./errors";
import { createCancelToken, hashCancelToken, looksLikeCancelToken } from "./cancel-token";
import { depositOf, depositPaidCents } from "@/lib/deposit/server";

/**
 * Emails the owner sends from /admin after a session: "Send sneak peek" (thank-you + Pixieset gallery to choose their
 * favorites + pay link while unpaid; kind "after_session") and "Gallery delivered" (review request + referral, + pay
 * link while unpaid). Each is one booking_emails row per booking and session time:
 * sent once; a failed send can be tried again. The row's link token opens /pay (both kinds) and /review (gallery).
 */
export const AFTER_KINDS = { afterSession: "after_session", gallery: "gallery_delivered", paymentLink: "payment_link" } as const;
export type AfterKind = (typeof AFTER_KINDS)[keyof typeof AFTER_KINDS];

/**
 * What the family still owes: the price booked (snapshot, never recalculated from today's bundles) + travel fee,
 * minus a paid deposit.
 */
export const amountDueCents = (row: Booking, paidDepositCents = 0) => Math.max(0, (row.finalPriceCents ?? row.packagePrice * 100) + (row.addonsTotalCents ?? 0) + (row.travelFeeCents ?? 0) - paidDepositCents);

/** Same, reading the booking's deposit. */
export const balanceDueCents = async (row: Booking) => amountDueCents(row, depositPaidCents(await depositOf(row.id)));

/**
 * What the booking's payment link charges next: a deposit that couldn't be taken while booking (Stripe was down)
 * while the session is still ahead, else what's still owed.
 */
export function nextCharge(row: Booking, deposit: Pick<BookingDeposit, "status" | "amountCents"> | null, now = new Date()): { kind: "deposit" | "balance"; amountCents: number } {
  if (deposit?.status === "unpaid" && row.sessionStart.getTime() > now.getTime()) return { kind: "deposit", amountCents: deposit.amountCents };
  return { kind: "balance", amountCents: amountDueCents(row, depositPaidCents(deposit)) };
}

const base = () => site.url.replace(/\/$/, "");
/** The booking's permanent payment link; the email's own token link only if the signing secret is missing. */
export const payUrl = (row: Booking, token: string) => bookingPayUrl(row.bookingReference) ?? `${base()}/pay?t=${token}`;
export const reviewUrl = (token: string) => `${base()}/review?t=${token}`;

/** Booking behind the link in one of these emails (null if unknown). */
export async function findByEmailLink(token: string, kinds: AfterKind[]): Promise<Booking | null> {
  if (!looksLikeCancelToken(token)) return null;
  const [hit] = await getDb()
    .select({ booking: bookings })
    .from(bookingEmails)
    .innerJoin(bookings, eq(bookings.id, bookingEmails.bookingId))
    .where(and(eq(bookingEmails.linkTokenHash, hashCancelToken(token)), inArray(bookingEmails.kind, kinds)))
    .limit(1);
  return hit?.booking ?? null;
}

async function isPaid(bookingId: string): Promise<boolean> {
  const [p] = await getDb().select({ status: bookingPayments.status }).from(bookingPayments).where(eq(bookingPayments.bookingId, bookingId)).limit(1);
  return p?.status === "paid";
}

/** Claims the email (new row, or a failed one to try again). Throws if it was already sent or is being sent. */
async function claim(row: Booking, kind: AfterKind, tokenHash: string): Promise<string> {
  const now = new Date();
  const [claimed] = await getDb()
    .insert(bookingEmails)
    .values({ bookingId: row.id, kind, sessionStart: row.sessionStart, linkTokenHash: tokenHash })
    .onConflictDoUpdate({
      target: [bookingEmails.bookingId, bookingEmails.kind, bookingEmails.sessionStart],
      set: { status: "sending", attempts: sql`${bookingEmails.attempts} + 1`, error: null, linkTokenHash: tokenHash, updatedAt: now },
      setWhere: sql`${bookingEmails.status} = 'failed'`,
    })
    .returning({ id: bookingEmails.id });
  if (!claimed) throw new BookingError("invalid_request", "This email was already sent.");
  return claimed.id;
}

async function deliver(row: Booking, kind: AfterKind, build: (token: string, themeId: string) => Promise<{ subject: string; html: string; text: string; attachments: { filename: string; content: string; contentType: string; contentId: string }[] }>) {
  if (row.status === "cancelled") throw new BookingError("invalid_request", "This booking is cancelled.");
  const token = createCancelToken();
  const id = await claim(row, kind, token.hash);
  const db = getDb();
  try {
    const themeId = await getSiteSettings().then((s) => s.themeId).catch(() => "default");
    const mail = await build(token.token, themeId);
    const { id: resendId } = await sendEmail({
      scope: `resend.${kind}`,
      to: row.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `${kind}/${row.bookingReference}/${id}`,
      reference: row.bookingReference,
    });
    await db.update(bookingEmails).set({ status: "sent", resendId, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, id));
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("after-session", "Email not sent", { reference: row.bookingReference, kind, code, error: err instanceof EmailSendError ? undefined : (err as Error) });
    await db.update(bookingEmails).set({ status: "failed", error: code, updatedAt: new Date() }).where(eq(bookingEmails.id, id)).catch(() => undefined);
    throw new BookingError("server_error", `The email wasn't sent (${code}). Please try again.`);
  }
}

const detailsOf = (row: Booking) => ({ reference: row.bookingReference, parentName: row.parentName, babyName: row.babyName, bundleName: row.packageName });

/**
 * "Send sneak peek": thank-you + the Pixieset gallery + "choose your N favorites". The pay button is included only if
 * the session isn't paid yet when the email is sent (e.g. no button if they already paid with the payment link).
 */
export async function sendSneakPeekEmail(row: Booking, galleryUrl: string, favorites: string) {
  const amountCents = await balanceDueCents(row);
  const paid = await isPaid(row.id);
  return deliver(row, AFTER_KINDS.afterSession, (token, themeId) =>
    sneakPeekEmail(detailsOf(row), { themeId, galleryUrl, favorites, amountCents, paid, payUrl: amountCents > 0 && !paid ? payUrl(row, token) : undefined }),
  );
}

/** "Gallery delivered": review request + referral, and a pay button while the session is still unpaid. */
export async function sendGalleryEmail(row: Booking, galleryUrl?: string) {
  const amountCents = await balanceDueCents(row);
  const unpaid = amountCents > 0 && !(await isPaid(row.id));
  return deliver(row, AFTER_KINDS.gallery, (token, themeId) =>
    galleryDeliveredEmail(detailsOf(row), { themeId, reviewUrl: reviewUrl(token), galleryUrl, pay: unpaid ? { amountCents, url: payUrl(row, token) } : null }),
  );
}

/** "Email the payment link": any time (before or after the session), and as often as needed — it's always the same link. */
export async function sendPaymentLinkEmail(row: Booking) {
  if (row.status === "cancelled") throw new BookingError("invalid_request", "This booking is cancelled.");
  const next = nextCharge(row, await depositOf(row.id));
  const amountCents = next.amountCents;
  if (amountCents <= 0) throw new BookingError("invalid_request", "There's nothing to pay for this booking.");
  if (next.kind === "balance" && (await isPaid(row.id))) throw new BookingError("invalid_request", "This booking is already paid.");
  const link = bookingPayUrl(row.bookingReference);
  if (!link) throw new BookingError("server_error", "Payment links need ADMIN_SESSION_SECRET.");
  const db = getDb();
  const now = new Date();
  const [claimed] = await db
    .insert(bookingEmails)
    .values({ bookingId: row.id, kind: AFTER_KINDS.paymentLink, sessionStart: row.sessionStart })
    .onConflictDoUpdate({ target: [bookingEmails.bookingId, bookingEmails.kind, bookingEmails.sessionStart], set: { status: "sending", attempts: sql`${bookingEmails.attempts} + 1`, error: null, updatedAt: now } })
    .returning({ id: bookingEmails.id, attempts: bookingEmails.attempts });
  try {
    const themeId = await getSiteSettings().then((s) => s.themeId).catch(() => "default");
    const mail = await paymentLinkEmail(detailsOf(row), { themeId, amountCents, payUrl: link, date: row.sessionDate });
    const { id: resendId } = await sendEmail({
      scope: "resend.payment_link",
      to: row.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
      replyTo: emailConfig().notify,
      idempotencyKey: `payment_link/${row.bookingReference}/${claimed.attempts}`,
      reference: row.bookingReference,
    });
    await db.update(bookingEmails).set({ status: "sent", resendId, sentAt: new Date(), updatedAt: new Date() }).where(eq(bookingEmails.id, claimed.id));
  } catch (err) {
    const code = (err instanceof EmailSendError ? err.code : "send_failed").slice(0, 120);
    log.error("after-session", "Payment link email not sent", { reference: row.bookingReference, code, error: err instanceof EmailSendError ? undefined : (err as Error) });
    await db.update(bookingEmails).set({ status: "failed", error: code, updatedAt: new Date() }).where(eq(bookingEmails.id, claimed.id)).catch(() => undefined);
    throw new BookingError("server_error", `The email wasn't sent (${code}). Please try again.`);
  }
}
