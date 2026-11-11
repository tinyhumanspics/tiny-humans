import "server-only";
import { and, count, desc, eq, gte, inArray, lte, ne, notInArray, sql } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import { getDb } from "@/lib/db/client";
import { bookingCompletions, bookingConsents, bookingDeposits, bookingEmails, bookingPayments, bookings, reviews, type Booking, type BookingAccess, type BookingBackdrops, type BookingConsent, type BookingDeposit, type BookingEmail, type BookingPayment, type BookingTerm, type EmailEvent, type Review } from "@/lib/db/schema";
import { emailEventsFor, emailNameOf, problemsOf, type EmailProblem } from "@/lib/email/delivery";
import { photosLabelOf, termsFor } from "@/lib/booking/terms";
import { accessFor } from "@/lib/booking/access";
import { backdropsFor } from "@/lib/booking/backdrops";
import { amountDueCents, nextCharge } from "@/lib/booking/after-session";
import { depositPaidCents, depositsFor, isMissingTable } from "@/lib/deposit/server";
import { depositPageUrl } from "@/lib/deposit/flow";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { historyFor, localDate } from "@/lib/booking/reschedule";
import { snapshotOf } from "@/lib/booking/details";
import type { Lead, LeadDeposit, LeadFilter, LeadList, LeadStatus, SentEmail } from "./types";
import { sourceLabel } from "@/lib/tracking/attribution";
import { log } from "@/lib/log";
import { bookingPayUrl } from "@/lib/payments/link";
import { BookingError } from "@/lib/booking/errors";
import { duplicateBookingsFor } from "./duplicates";
import { addonsFor, babiesFor, familyFor } from "@/lib/booking/addons";
import type { FamilyMember } from "@/lib/booking/family";
import { waiversForBookings } from "@/lib/waiver/server";
import { notPaidDue } from "@/lib/due-date/server";
import { categoriesForCodes } from "@/lib/pricing/server";
import type { WaiverSummary } from "@/lib/waiver/types";
import type { AddonLine, BookingBaby } from "@/lib/booking/extra-babies";

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
  /** Delivery problems Resend reported for these families' addresses. */
  emailEvents: EmailEvent[];
  babies: Map<string, BookingBaby[]>;
  family: Map<string, FamilyMember[]>;
  addons: Map<string, AddonLine[]>;
  /** Photo and video releases (best effort: none before migration 0023). */
  waivers: Map<string, WaiverSummary>;
  /** Today's cancel/reschedule notice (bookings without their own terms). */
  noticeHours: number;
  /** Discount code (upper case) → its category (best effort: none before migration 0028). */
  codeCategories: Map<string, string>;
  /** Leads the owner marked "Completed" → when (best effort: none before migration 0030). */
  completions: Map<string, Date>;
}

/** Leads marked "Completed" (owner, Nov 11): booking id → when. Best effort: none before migration 0030. */
async function completions(bookingIds?: string[]): Promise<Map<string, Date>> {
  if (bookingIds && !bookingIds.length) return new Map();
  try {
    const q = getDb().select().from(bookingCompletions);
    const rows = await (bookingIds ? q.where(inArray(bookingCompletions.bookingId, bookingIds)) : q);
    return new Map(rows.map((r) => [r.bookingId, r.completedAt]));
  } catch (err) {
    if (!isMissingTable(err)) log.error("leads", "Could not load completed leads", { error: err as Error });
    return new Map();
  }
}

const NO_EXTRAS: Extras = { emails: [], payments: [], reviews: [], consents: [], terms: [], access: [], backdrops: [], deposits: [], emailEvents: [], babies: new Map(), family: new Map(), addons: new Map(), waivers: new Map(), noticeHours: 48, codeCategories: new Map(), completions: new Map() };

/** Reminder/after-session emails, payments and reviews of these bookings (empty if a table isn't there yet). */
async function extrasFor(rows: Booking[]): Promise<Extras> {
  const bookingIds = rows.map((r) => r.id);
  if (!bookingIds.length) return NO_EXTRAS;
  const db = getDb();
  const safe = <T,>(what: string, q: Promise<T[]>) =>
    q.catch((err) => {
      log.error("leads", `Could not load ${what}`, { error: err as Error });
      return [] as T[];
    });
  const [emails, payments, revs, consents, terms, access, backdrops, deposits, emailEvents, babies, family, addons, waivers, noticeHours, codeCategories, done] = await Promise.all([
    safe("emails", db.select().from(bookingEmails).where(inArray(bookingEmails.bookingId, bookingIds))),
    safe("payments", db.select().from(bookingPayments).where(inArray(bookingPayments.bookingId, bookingIds))),
    safe("reviews", db.select().from(reviews).where(inArray(reviews.bookingId, bookingIds))),
    safe("permissions", db.select().from(bookingConsents).where(inArray(bookingConsents.bookingId, bookingIds))),
    termsFor(bookingIds),
    accessFor(bookingIds),
    backdropsFor(bookingIds),
    depositsFor(bookingIds),
    emailEventsFor(rows),
    babiesFor(bookingIds),
    familyFor(bookingIds),
    addonsFor(bookingIds),
    waiversForBookings(bookingIds),
    getNoticeHoursSetting().catch(() => 48),
    categoriesForCodes(rows.map((r) => r.discountCode ?? "")),
    completions(bookingIds),
  ]);
  return { emails, payments, reviews: revs, consents, terms, access, backdrops, deposits, emailEvents, babies, family, addons, waivers, noticeHours, codeCategories, completions: done };
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
      link: (r.status === "confirmed" || r.status === "rescheduled") && next.amountCents > 0 ? bookingPayUrl(r.bookingReference, r.locale) : null,
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
  const linkEmail = x.emails.find((e) => e.bookingId === r.id && e.kind === "deposit_link");
  const payLink = x.emails.filter((e) => e.bookingId === r.id && e.kind === "payment_link").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  // booked while Stripe was down: the payment link takes the deposit; otherwise the "Finish booking" email
  const reminder = d.status === "unpaid" ? payLink : linkEmail;
  const held = r.status === "pending" && d.status === "pending" && Boolean(d.holdUntil && d.holdUntil.getTime() > Date.now());
  return {
    amountCents: d.amountCents,
    status: d.status as LeadDeposit["status"],
    paidAt: iso(d.paidAt),
    refundedAt: iso(d.refundedAt),
    refundError: d.refundError,
    holdUntil: iso(d.holdUntil),
    late: (r.sessionStart.getTime() - Date.now()) / 3_600_000 < notice,
    abandonedEmail: sent(abandoned),
    link: held ? depositPageUrl(r) : null,
    linkEmail: sent(linkEmail),
    reminders: reminder ? { count: reminder.attempts, last: sent(reminder)! } : null,
  };
}

export function toLead(r: Booking, history: HistoryRow[] = [], x: Extras = NO_EXTRAS, duplicate?: Lead["duplicate"]): Lead {
  const emails = x.emails;
  return {
    reference: r.bookingReference,
    status: r.status as LeadStatus,
    parentName: r.parentName,
    email: r.email,
    phone: r.phone,
    duplicate,
    babyName: r.babyName,
    babyAge: r.babyAge,
    babies: x.babies.get(r.id) ?? [{ name: r.babyName ?? undefined, age: r.babyAge }],
    family: x.family.get(r.id) ?? [],
    bundleId: r.packageId,
    bundleName: r.packageName,
    pricing: (({ bundleId: _b, bundleName: _n, offerEndsOn: _e, note: _x, ...p }) => p)(snapshotOf(r, x.addons.get(r.id))),
    codeCategory: r.discountCode ? x.codeCategories.get(r.discountCode.trim().toUpperCase()) ?? null : null,
    completedAt: x.completions.get(r.id)?.toISOString() ?? null,
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
    emailProblems: problemsOf(r, x.emailEvents).map((e) => ({ kind: e.type as EmailProblem, at: e.occurredAt.toISOString(), email: emailNameOf(e.category), detail: e.detail })),
    waiver: x.waivers.get(r.id) ?? null,
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
/**
 * Leads → Not paid (owner, Nov 11): bookings still missing their deposit, so a reminder can still be sent: waiting at
 * the Stripe page (time held), booked while Stripe was down (nothing paid yet), or released because the page ran out
 * (only while the date is ahead, not cancelled by the owner, and the family hasn't booked again since).
 */
const notPaidWhere = (today: string) => sql`exists (
  select 1 from ${bookingDeposits} d
  where d.booking_id = ${bookings.id} and d.amount_cents > 0 and (
    (d.status = 'pending' and ${bookings.status} = 'pending')
    or (d.status = 'unpaid' and ${bookings.status} in ('confirmed', 'rescheduled')
      and not exists (select 1 from ${bookingPayments} p where p.booking_id = ${bookings.id} and p.status = 'paid'))
    or (d.status = 'expired' and ${bookings.status} = 'cancelled' and ${bookings.cancelledBy} is distinct from 'admin'
      and ${bookings.sessionDate} >= ${today}
      and not exists (select 1 from ${bookings} b2 where lower(b2.email) = lower(${bookings.email}) and b2.status <> 'cancelled' and b2.created_at > ${bookings.createdAt}))
  ))`;

export async function listLeads(filter: LeadFilter, limit = 50, offset = 0): Promise<LeadList> {
  const db = getDb();
  // "Completed" (owner, Nov 11): a marked lead moves out of its status section into Completed (All still lists it)
  const doneIds = [...(await completions()).keys()];
  const active = ne(bookings.status, "cancelled");
  const notPaid = and(notPaidWhere(todayInZone(bookingRules.timeZone)), doneIds.length ? notInArray(bookings.id, doneIds) : undefined);
  const where =
    filter === "all" ? active
    : filter === "not_paid" ? notPaid
    : filter === "completed" ? (doneIds.length ? and(active, inArray(bookings.id, doneIds)) : sql`false`)
    : filter !== "cancelled" && doneIds.length ? and(eq(bookings.status, filter), notInArray(bookings.id, doneIds))
    : eq(bookings.status, filter);
  const [rows, grouped, groupedDone, [notPaidCount], due] = await Promise.all([
    db.select().from(bookings).where(where).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset),
    db.select({ status: bookings.status, n: count() }).from(bookings).groupBy(bookings.status),
    doneIds.length ? db.select({ status: bookings.status, n: count() }).from(bookings).where(inArray(bookings.id, doneIds)).groupBy(bookings.status) : Promise.resolve([]),
    db.select({ n: count() }).from(bookings).where(notPaid),
    notPaidDue(),
  ]);
  const counts = { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0, completed: 0, not_paid: Number(notPaidCount?.n ?? 0) + due.length } as Record<LeadFilter, number>;
  for (const g of grouped) {
    counts[g.status as LeadStatus] = Number(g.n);
    if (g.status !== "cancelled") counts.all += Number(g.n);
  }
  for (const g of groupedDone) {
    if (g.status === "cancelled") continue;
    counts[g.status as LeadStatus] -= Number(g.n);
    counts.completed += Number(g.n);
  }
  const ids = rows.map((r) => r.id);
  const [history, extras, money, activeContacts] = await Promise.all([
    historyFor(ids),
    extrasFor(rows),
    filter === "all" ? moneyTotals() : undefined,
    db.select({ reference: bookings.bookingReference, status: bookings.status, email: bookings.email, phone: bookings.phone }).from(bookings).where(ne(bookings.status, "cancelled")),
  ]);
  const duplicates = duplicateBookingsFor(rows.map((r) => ({ reference: r.bookingReference, status: r.status as LeadStatus, email: r.email, phone: r.phone })), activeContacts as Parameters<typeof duplicateBookingsFor>[1]);
  const total = filter === "all" ? counts.all : filter === "not_paid" ? Number(notPaidCount?.n ?? 0) : counts[filter];
  return { leads: rows.map((r) => toLead(r, history, extras, duplicates.get(r.bookingReference))), counts, total, money, ...(filter === "not_paid" ? { notPaidDue: due } : {}) };
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
            sql`coalesce(${bookings.finalPriceCents}, ${bookings.packagePrice} * 100) + coalesce(${bookings.addonsTotalCents}, 0) + coalesce(${bookings.travelFeeCents}, 0) - coalesce(${bookingDeposits.amountCents}, 0) > 0`,
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
  if (!row) return null;
  const [history, extras, activeContacts] = await Promise.all([
    historyFor([row.id]),
    extrasFor([row]),
    getDb().select({ reference: bookings.bookingReference, status: bookings.status, email: bookings.email, phone: bookings.phone }).from(bookings).where(ne(bookings.status, "cancelled")),
  ]);
  const duplicates = duplicateBookingsFor(
    [{ reference: row.bookingReference, status: row.status as LeadStatus, email: row.email, phone: row.phone }],
    activeContacts as Parameters<typeof duplicateBookingsFor>[1],
  );
  return toLead(row, history, extras, duplicates.get(row.bookingReference));
}

export async function getLeadRow(reference: string): Promise<Booking | null> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return row ?? null;
}

export const isLeadFilter = (v: unknown): v is LeadFilter => v === "all" || v === "completed" || v === "not_paid" || STATUSES.includes(v as LeadStatus);

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
