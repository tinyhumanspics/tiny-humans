import "server-only";
import { bookingRules } from "@/config/booking";
import { setupsOf } from "@/config/backdrops";
import type { Booking } from "@/lib/db/schema";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { internalBackdropEmail } from "@/lib/email";
import { log } from "@/lib/log";
import { isMicrosoftConfigured } from "@/lib/microsoft/config";
import { updateCalendarEventBody } from "@/lib/microsoft/calendar";
import { backdropsFor, saveBackdrops } from "./backdrops";
import { findByCancelToken } from "./cancellation";
import { BookingError } from "./errors";
import { detailsFromRow } from "./details";
import { eventBodyHtml } from "./templates";
import { addDaysKey, todayInZone } from "./timezone";
import en from "@/messages/en.json";
import { site } from "@/config/site";
import { fill } from "@/lib/email/messages";

/** What the backdrop page (/backdrop?t=…) shows. */
export interface BackdropView {
  bundleName: string;
  date: string;
  start: string;
  firstName: string;
  /** How many they can pick (one per setup). */
  setups: number;
  picks: string[];
  /** Until the day before the session (Miami time), and not cancelled. */
  canChange: boolean;
  status: "active" | "cancelled" | "past";
}

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const closedText = () => fill(en.backdropPage.closed, { phone: site.contact.phone });

export function canChangeBackdrop(row: Booking, now = new Date()): boolean {
  return row.status !== "cancelled" && todayInZone(bookingRules.timeZone, now) < addDaysKey(row.sessionDate, -1);
}

function viewOf(row: Booking, picks: string[], now = new Date()): BackdropView {
  const status = row.status === "cancelled" ? "cancelled" : row.sessionStart.getTime() <= now.getTime() ? "past" : "active";
  return {
    bundleName: row.packageName,
    date: row.sessionDate,
    start: localTime(row.sessionStart, row.timezone),
    firstName: row.parentName.split(" ")[0],
    setups: setupsOf(row.packageInclusions ?? []),
    picks,
    canChange: status === "active" && canChangeBackdrop(row, now),
    status,
  };
}

async function rowFor(token: string): Promise<Booking> {
  const row = await findByCancelToken(token);
  if (!row) throw new BookingError("not_found", fill(en.backdropPage.invalid, { phone: site.contact.phone }));
  return row;
}

export async function getBackdropView(token: string): Promise<BackdropView> {
  const row = await rowFor(token);
  const [saved] = await backdropsFor([row.id]);
  return viewOf(row, saved?.picks ?? []);
}

/** Saves the family's new picks; returns the booking and what it had before (for the studio email + Outlook). */
export async function saveBackdropsWithToken(token: string, picks: string[]): Promise<{ view: BackdropView; row: Booking; before: string[] }> {
  const row = await rowFor(token);
  if (!canChangeBackdrop(row)) throw new BookingError("reschedule_closed", closedText());
  const setups = setupsOf(row.packageInclusions ?? []);
  if (picks.length > setups) throw new BookingError("invalid_request", `Pick up to ${setups}.`);
  const [saved] = await backdropsFor([row.id]);
  await saveBackdrops(row.id, picks, "family");
  return { view: viewOf(row, picks), row, before: saved?.picks ?? [] };
}

/** After a change: the studio email, then the Outlook event's description rebuilt with the new picks. Never throws. */
export async function afterBackdropChange(row: Booking, before: string[], after: string[]): Promise<void> {
  try {
    const mail = await internalBackdropEmail({ reference: row.bookingReference, parentName: row.parentName, email: row.email, phone: row.phone, bundleName: row.packageName, date: row.sessionDate, start: localTime(row.sessionStart, row.timezone), before, after });
    await sendEmail({ scope: "resend.internal", from: emailConfig().internalFrom, to: emailConfig().notify, subject: mail.subject, html: mail.html, text: mail.text, replyTo: row.email, idempotencyKey: `backdrop/${row.bookingReference}/${after.join("+") || "none"}/${Date.now()}`, reference: row.bookingReference });
  } catch (err) {
    log.error("backdrop", "Studio email not sent", { reference: row.bookingReference, error: err as Error });
  }
  await refreshCalendarEvent(row).catch((err) => log.error("backdrop", "Outlook event not updated", { reference: row.bookingReference, error: err as Error }));
}

/** Rebuilds the Outlook event's description from the saved booking (same rows as when it was booked). */
async function refreshCalendarEvent(row: Booking): Promise<void> {
  if (!row.outlookEventId || row.status === "cancelled" || !isMicrosoftConfigured()) return;
  await updateCalendarEventBody(row.outlookEventId, eventBodyHtml(await detailsFromRow(row)));
}
