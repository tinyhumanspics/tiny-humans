import "server-only";
import { count, desc, eq, ne } from "drizzle-orm";
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
  if (row.status !== "cancelled") {
    await cancelBookingRow(row, { reason: "Deleted by admin", by: "admin", silent: true });
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
