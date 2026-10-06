import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, type Booking } from "@/lib/db/schema";
import { historyFor, localDate } from "@/lib/booking/reschedule";
import type { Lead, LeadFilter, LeadList, LeadStatus } from "./types";

const time = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

type HistoryRow = Awaited<ReturnType<typeof historyFor>>[number];

export function toLead(r: Booking, history: HistoryRow[] = []): Lead {
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
    packagePrice: r.packagePrice,
    sessionDate: r.sessionDate,
    start: time(r.sessionStart, r.timezone),
    end: time(r.sessionEnd, r.timezone),
    locationType: r.locationType,
    address: r.locationAddress,
    notes: r.notes,
    inspirationPhotoId: r.inspirationPhotoId,
    calendarLinked: Boolean(r.outlookEventId) && r.status !== "cancelled",
    confirmationEmail: { sent: r.confirmationEmailSent, at: iso(r.confirmationEmailSentAt), error: r.confirmationEmailError },
    internalNotification: { sent: r.internalNotificationSent, at: iso(r.internalNotificationSentAt), error: r.internalNotificationError },
    history: history
      .filter((h) => h.bookingId === r.id)
      .map((h) => ({ oldDate: localDate(h.oldSessionStart, r.timezone), oldStart: time(h.oldSessionStart, r.timezone), newDate: localDate(h.newSessionStart, r.timezone), newStart: time(h.newSessionStart, r.timezone), newEnd: time(h.newSessionEnd, r.timezone), by: h.rescheduledBy as "customer" | "admin", at: h.createdAt.toISOString() })),
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
    createdAt: r.createdAt.toISOString(),
  };
}

const STATUSES: LeadStatus[] = ["pending", "confirmed", "rescheduled", "cancelled"];

/** Newest first. Counts are computed in the database across all leads. */
export async function listLeads(filter: LeadFilter, limit = 50, offset = 0): Promise<LeadList> {
  const db = getDb();
  const where = filter === "all" ? undefined : eq(bookings.status, filter);
  const [rows, grouped] = await Promise.all([
    db.select().from(bookings).where(where).orderBy(desc(bookings.createdAt)).limit(limit).offset(offset),
    db.select({ status: bookings.status, n: count() }).from(bookings).groupBy(bookings.status),
  ]);
  const counts = { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0 } as Record<LeadFilter, number>;
  for (const g of grouped) {
    counts[g.status as LeadStatus] = Number(g.n);
    counts.all += Number(g.n);
  }
  const history = await historyFor(rows.map((r) => r.id));
  return { leads: rows.map((r) => toLead(r, history)), counts, total: filter === "all" ? counts.all : counts[filter] };
}

export async function getLead(reference: string): Promise<Lead | null> {
  const row = await getLeadRow(reference);
  return row ? toLead(row, await historyFor([row.id])) : null;
}

export async function getLeadRow(reference: string): Promise<Booking | null> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return row ?? null;
}

export const isLeadFilter = (v: unknown): v is LeadFilter => v === "all" || STATUSES.includes(v as LeadStatus);
