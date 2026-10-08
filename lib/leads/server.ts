import "server-only";
import { and, count, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import { getDb } from "@/lib/db/client";
import { bookingConsents, bookingDeposits, bookingEmails, bookingPayments, bookings, reviews, type Booking, type BookingAccess, type BookingBackdrops, type BookingConsent, type BookingDeposit, type BookingEmail, type BookingPayment, type BookingTerm, type Review } from "@/lib/db/schema";
import { photosLabelOf, termsFor } from "@/lib/booking/terms";
import { accessFor } from "@/lib/booking/access";
import { backdropsFor } from "@/lib/booking/backdrops";
import { amountDueCents, nextCharge } from "@/lib/booking/after-session";
import { depositPaidCents, depositsFor } from "@/lib/deposit/server";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { historyFor, localDate } from "@/lib/booking/reschedule";
import { snapshotOf } from "@/lib/booking/details";
import type { Lead, LeadDeposit, LeadFilter, LeadList, LeadStatus, SentEmail } from "./types";
import { sourceLabel } from "@/lib/tracking/attribution";
import { log } from "@/lib/log";
import { bookingPayUrl } from "@/lib/payments/link";
import { BookingError } from "@/lib/booking/errors";

const time = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

type HistoryRow = Awaited<ReturnType<typeof historyFor>>[number];

const REMINDER_KIND: Record<string, "72h" | "24h"> = { reminder_72h: "72h", reminder_24h: "24h" };

interface Extras {
  emails: BookingEmail[];
  payments: BookingPayment[];
  reviews: Review[];
  consents: BookingConsent[];
  terms: BookingTerm[];
  access: BookingAccess[];
  backdrops: BookingBackdrops[];
  deposits: BookingDeposit[];
  /** Today's cancel/reschedule notice (bookings without their own terms). */
  noticeHours: number;
}

const NO_EXTRAS: Extras = { emails: [], payments: [], reviews: [], consents: [], terms: [], access: [], backdrops: [], deposits: [], noticeHours: 48 };

/** Reminder/after-session emails, payments and reviews of these bookings (empty if a table isn't there yet). */
async function extrasFor(bookingIds: string[]): Promise<Extras> {
  if (!bookingIds.length) return NO_EXTRAS;
  const db = getDb();
  const safe = <T,>(what: string, q: Promise<T[]>) =>
    q.catch((err) => {
      log.error("leads", `Could not load ${what}`, { error: err as Error });
      return [] as T[];
    });
  const [emails, payments, revs, consents, terms, access, backdrops, deposits, noticeHours] = await Promise.all([
    safe("emails", db.select().from(bookingEmails).where(inArray(bookingEmails.bookingId, bookingIds))),
    safe("payments", db.select().from(bookingPayments).where(inArray(bookingPayments.bookingId, bookingIds))),
    safe("reviews", db.select().from(reviews).where(inArray(reviews.bookingId, bookingIds))),
    safe("permissions", db.select().from(bookingConsents).where(inArray(bookingConsents.bookingId, bookingIds))),
    termsFor(bookingIds),
    accessFor(bookingIds),
    backdropsFor(bookingIds),
    depositsFor(bookingIds),
    getNoticeHoursSetting().catch(() => 48),
  ]);
  return { emails, payments, reviews: revs, consents, terms, access, backdrops, deposits, noticeHours };
}

const sent = (e: BookingEmail | undefined): SentEmail | null => (e ? { status: e.status as SentEmail["status"], at: iso(e.sentAt ?? e.updatedAt), error: e.error } : null);

function afterOf(r: Booking, x: Extras): Lead["after"] {
  const current = (kind: string) => x.emails.find((e) => e.bookingId === r.id && e.kind === kind && e.sessionStart.getTime() === r.sessionStart.getTime());
  const pay = x.payments.find((p) => p.bookingId === r.id);
  const deposit = x.deposits.find((d) => d.bookingId === r.id) ?? null;
  const amountCents = amountDueCents(r, depositPaidCents(deposit));
  const next = nextCharge(r, deposit);
  const linkEmail = x.emails.filter((e) => e.bookingId === r.id && e.kind === "payment_link").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const review = x.reviews.find((v) => v.bookingId === r.id);
  return {
    canSend: r.status === "confirmed" || r.status === "rescheduled",
    started: r.sessionStart.getTime() <= Date.now(),
    ended: r.sessionEnd.getTime() <= Date.now(),
    sessionDone: sent(current("after_session")),
    favorites: photosLabelOf(r, x.terms.find((t) => t.bookingId === r.id)),
    gallery: sent(current("gallery_delivered")),
    payment: {
      amountCents,
      next,
      status: pay?.status === "paid" ? "paid" : pay ? "open" : "unpaid",
      paidAt: iso(pay?.paidAt ?? null),
      link: (r.status === "confirmed" || r.status === "rescheduled") && next.amountCents > 0 ? bookingPayUrl(r.bookingReference) : null,
      linkEmail: sent(linkEmail),
    },
    review: review ? { rating: review.rating, body: review.body, displayName: review.displayName, consentPublic: review.consentPublic, approved: review.approved, at: review.updatedAt.toISOString() } : null,
  };
}

function leadDepositOf(r: Booking, x: Extras): LeadDeposit | null {
  const d = x.deposits.find((v) => v.bookingId === r.id);
  if (!d) return null;
  const notice = x.terms.find((t) => t.bookingId === r.id)?.noticeHours ?? x.noticeHours;
  const abandoned = x.emails.find((e) => e.bookingId === r.id && e.kind === "deposit_abandoned");
  return {
    amountCents: d.amountCents,
    status: d.status as LeadDeposit["status"],
    paidAt: iso(d.paidAt),
    refundedAt: iso(d.refundedAt),
    refundError: d.refundError,
    holdUntil: iso(d.holdUntil),
    late: (r.sessionStart.getTime() - Date.now()) / 3_600_000 < notice,
    abandonedEmail: sent(abandoned),
  };
}

export function toLead(r: Booking, history: HistoryRow[] = [], x: Extras = NO_EXTRAS): Lead {
  const emails = x.emails;
  return {
    reference: r.bookingReference,
    status: r.status as LeadStatus,
    parentName: r.parentName,
    email: r.email,
    phone: r.phone,
    babyName: r.babyName,
    babyAge: r.babyAge,
    bundleId: r.packageId,
    bundleName: r.packageName,
    pricing: (({ bundleId: _b, bundleName: _n, offerEndsOn: _e, note: _x, ...p }) => p)(snapshotOf(r)),
    sessionDate: r.sessionDate,
    start: time(r.sessionStart, r.timezone),
    end: time(r.sessionEnd, r.timezone),
    locationType: r.locationType,
    address: r.locationAddress,
    access: x.access.find((a) => a.bookingId === r.id)?.notes ?? null,
    travel: { feeCents: r.travelFeeCents, miles: r.travelMiles },
    backdrops: ((b) => (b ? { picks: b.picks, source: b.source, at: b.updatedAt.toISOString() } : null))(x.backdrops.find((b) => b.bookingId === r.id)),
    notes: r.notes,
    inspirationPhotoId: r.inspirationPhotoId,
    calendarLinked: Boolean(r.outlookEventId) && r.status !== "cancelled",
    confirmationEmail: { sent: r.confirmationEmailSent, at: iso(r.confirmationEmailSentAt), error: r.confirmationEmailError },
    internalNotification: { sent: r.internalNotificationSent, at: iso(r.internalNotificationSentAt), error: r.internalNotificationError },
    history: history
      .filter((h) => h.bookingId === r.id)
      .map((h) => ({ oldDate: localDate(h.oldSessionStart, r.timezone), oldStart: time(h.oldSessionStart, r.timezone), newDate: localDate(h.newSessionStart, r.timezone), newStart: time(h.newSessionStart, r.timezone), newEnd: time(h.newSessionEnd, r.timezone), by: h.rescheduledBy as "customer" | "admin", at: h.createdAt.toISOString() })),
    reminders: emails
      .filter((e) => e.bookingId === r.id && REMINDER_KIND[e.kind] && e.sessionStart.getTime() === r.sessionStart.getTime())
      .map((e) => ({ kind: REMINDER_KIND[e.kind], status: e.status as "sending" | "sent" | "failed", at: iso(e.sentAt ?? e.updatedAt), error: e.error }))
      .sort((a, b) => (a.kind === "72h" ? -1 : 1) - (b.kind === "72h" ? -1 : 1)),
    after: afterOf(r, x),
    deposit: leadDepositOf(r, x),
    consents: (({ sms, smsAt, photos, photosAt }) => ({ sms, smsAt: iso(smsAt), photos, photosAt: iso(photosAt) }))(x.consents.find((c) => c.bookingId === r.id) ?? { sms: false, smsAt: null, photos: false, photosAt: null }),
    cancellation:
      r.status === "cancelled"
        ? {
            reason: r.cancellationReason,
            at: iso(r.cancelledAt),
            by: (r.cancelledBy as "customer" | "admin" | null) ?? null,
            email: { sent: r.cancellationEmailSent, at: iso(r.cancellationEmailSentAt), error: r.cancellationEmailError },
            internal: { sent: r.internalCancellationSent, at: iso(r.internalCancellationSentAt), error: r.internalCancellationError },
          }
        : null,
    source:
      r.firstTouchAt || r.utmSource || r.fbclid || r.referrer || r.landingPath
        ? {
            label: sourceLabel({ utmSource: r.utmSource ?? undefined, utmMedium: r.utmMedium ?? undefined, fbclid: r.fbclid ?? undefined, referrer: r.referrer ?? undefined }),
            campaign: r.utmCampaign,
            medium: r.utmMedium,
            content: r.utmContent,
            term: r.utmTerm,
            landingPath: r.landingPath,
            referrer: r.referrer,
            metaClick: Boolean(r.fbclid),
            at: iso(r.firstTouchAt),
          }
        : null,
    createdAt: r.createdAt.toISOString(),
  };
}

const STATUSES: LeadStatus[] = ["pending", "confirmed", "rescheduled", "cancelled"];

/** Newest first. "all" = every NON-cancelled lead. Counts come from the database (all leads, not this page). */
export async function listLeads(filter: LeadFilter, limit = 50, offset = 0): Promise<LeadList> {
  const db = getDb();
  const where = filter === "all" ? ne(bookings.status, "cancelled") : eq(bookings.status, filter);
  const [rows, grouped] = await Promise.all([
    db.select().from(bookings).where(where).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset),
    db.select({ status: bookings.status, n: count() }).from(bookings).groupBy(bookings.status),
  ]);
  const counts = { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0 } as Record<LeadFilter, number>;
  for (const g of grouped) {
    counts[g.status as LeadStatus] = Number(g.n);
    if (g.status !== "cancelled") counts.all += Number(g.n);
  }
  const ids = rows.map((r) => r.id);
  const [history, extras, money] = await Promise.all([historyFor(ids), extrasFor(ids), filter === "all" ? moneyTotals() : undefined]);
  return { leads: rows.map((r) => toLead(r, history, extras)), counts, total: filter === "all" ? counts.all : counts[filter], money };
}

/** Dashboard: card payments (+ deposits kept) received this month (Miami time) and finished sessions still unpaid. */
async function moneyTotals(now = new Date()): Promise<LeadList["money"]> {
  const tz = bookingRules.timeZone;
  const monthStart = zonedTimeToUtc(`${todayInZone(tz, now).slice(0, 7)}-01`, "00:00", tz);
  const db = getDb();
  try {
    const [[paid], [deposits], [unpaid]] = await Promise.all([
      db
        .select({ cents: sql<number>`coalesce(sum(${bookingPayments.amountCents}), 0)`.mapWith(Number) })
        .from(bookingPayments)
        .where(and(eq(bookingPayments.status, "paid"), gte(bookingPayments.paidAt, monthStart))),
      // deposits kept (paid, not refunded) paid this month
      db
        .select({ cents: sql<number>`coalesce(sum(${bookingDeposits.amountCents}), 0)`.mapWith(Number) })
        .from(bookingDeposits)
        .where(and(eq(bookingDeposits.status, "paid"), gte(bookingDeposits.paidAt, monthStart))),
      db
        .select({ n: count() })
        .from(bookings)
        .leftJoin(bookingPayments, eq(bookingPayments.bookingId, bookings.id))
        .leftJoin(bookingDeposits, and(eq(bookingDeposits.bookingId, bookings.id), eq(bookingDeposits.status, "paid")))
        .where(
          and(
            inArray(bookings.status, ["confirmed", "rescheduled"]),
            lte(bookings.sessionEnd, now),
            // something still owed after a paid deposit
            sql`coalesce(${bookings.finalPriceCents}, ${bookings.packagePrice} * 100) + coalesce(${bookings.travelFeeCents}, 0) - coalesce(${bookingDeposits.amountCents}, 0) > 0`,
            sql`${bookingPayments.status} is distinct from 'paid'`,
          ),
        ),
    ]);
    return { paidThisMonthCents: (paid?.cents ?? 0) + (deposits?.cents ?? 0), unpaidCount: Number(unpaid?.n ?? 0) };
  } catch (err) {
    log.error("leads", "Could not load payment totals", { error: err as Error });
    return null;
  }
}

export async function getLead(reference: string): Promise<Lead | null> {
  const row = await getLeadRow(reference);
  return row ? toLead(row, await historyFor([row.id]), await extrasFor([row.id])) : null;
}

export async function getLeadRow(reference: string): Promise<Booking | null> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return row ?? null;
}

export const isLeadFilter = (v: unknown): v is LeadFilter => v === "all" || STATUSES.includes(v as LeadStatus);

/**
 * Permanently delete a lead (admin cleanup, e.g. test bookings). Never leaves an
 * orphaned Outlook event: an active booking is first cancelled through the
 * consistent cancellation path WITHOUT emails (Neon -> Outlook, rolled back if
 * Outlook fails). If that fails, nothing is deleted. Then the row is removed;
 * reschedule history goes with it (ON DELETE CASCADE) and the management token
 * hash lives on the row itself. If the final delete fails, the booking is left
 * cleanly cancelled (Neon and Outlook agree) and the admin can retry.
 */
export async function deleteLeadPermanently(row: Booking): Promise<void> {
  const { cancelBookingRow } = await import("@/lib/booking/cancellation");
  const { refundDeposit } = await import("@/lib/deposit/refund");
  const { closeDepositPage } = await import("@/lib/deposit/flow");
  // still on its deposit page: close it first, so nobody can pay for a booking that's gone
  if (row.status === "pending" && !(await closeDepositPage(row))) throw new BookingError("server_error", "Couldn't close its deposit page on Stripe. Please try again in a minute.");
  if (row.status !== "cancelled") {
    // a paid deposit is refunded: the record of it is about to disappear
    await cancelBookingRow(row, { reason: "Deleted by admin", by: "admin", silent: true, refundDeposit: true });
  } else {
    await refundDeposit(row);
  }
  const { log } = await import("@/lib/log");
  try {
    await getDb().delete(bookings).where(eq(bookings.id, row.id));
  } catch (err) {
    log.error("admin.leads", "Delete failed after the booking was cancelled; it stays cancelled (consistent)", { error: err as Error, reference: row.bookingReference });
    throw err;
  }
  log.info("admin.leads", "Lead permanently deleted", { reference: row.bookingReference });
}
