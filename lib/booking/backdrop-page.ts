import "server-only";
import { and, eq } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { setupsOf } from "@/config/backdrops";
import { getDb } from "@/lib/db/client";
import { bookingAccess, bookingBabies, bookingBabyGenders, bookingConsents, bookings, type Booking } from "@/lib/db/schema";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { internalBackdropEmail } from "@/lib/email";
import { log } from "@/lib/log";
import { isMicrosoftConfigured } from "@/lib/microsoft/config";
import { updateCalendarEventBody } from "@/lib/microsoft/calendar";
import { accessFor } from "./access";
import { babiesFor } from "./addons";
import { backdropsFor, saveBackdrops } from "./backdrops";
import { findByCancelToken } from "./cancellation";
import { BookingError } from "./errors";
import { detailsFromRow, homeOf } from "./details";
import { eventBodyHtml, formatAddress } from "./templates";
import { addDaysKey, todayInZone } from "./timezone";
import en from "@/messages/en.json";
import { site } from "@/config/site";
import { fill } from "@/lib/email/messages";

/**
 * "Prepare for your session" (/backdrop?t=<management token>, brief 02): the details that left the booking form. The
 * home's street, gate/parking notes, the baby's name and boy or girl (owner, Nov 19), the backdrops and the photo-use
 * permission, saved where the
 * booking keeps them (Leads, the Outlook event and the emails show them as usual). Open until the day before.
 */
export interface BackdropView {
  bundleId: string;
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
  /** Their home: empty street = still to come (a booking made from a website request). The ZIP code isn't editable. */
  home: { street: string; city: string; zip: string; accessNotes: string };
  /** One per baby. */
  babyNames: string[];
  /** Boy or girl per baby ("" = not said); empty when the booking has no baby rows to attach it to. */
  babyGenders: ("boy" | "girl" | "")[];
  /** "OK to feature our photos" (unticked = no). */
  photos: boolean;
}

/** What the page saves: the backdrops, and the rest when the page sends it. */
export interface PrepareInput {
  picks: string[];
  home?: { street: string; city: string; accessNotes?: string };
  babyNames?: string[];
  babyGenders?: ("boy" | "girl" | "")[];
  photos?: boolean;
}

const localTime = (d: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const closedText = () => fill(en.backdropPage.closed, { phone: site.contact.phone });

export function canChangeBackdrop(row: Booking, now = new Date()): boolean {
  return row.status !== "cancelled" && todayInZone(bookingRules.timeZone, now) < addDaysKey(row.sessionDate, -1);
}

async function viewOf(row: Booking, now = new Date()): Promise<BackdropView> {
  const [[saved], [access], babies, [consent]] = await Promise.all([
    backdropsFor([row.id]),
    accessFor([row.id]),
    babiesFor([row.id]),
    getDb().select().from(bookingConsents).where(eq(bookingConsents.bookingId, row.id)).limit(1).catch(() => []),
  ]);
  const status = row.status === "cancelled" ? "cancelled" : row.sessionStart.getTime() <= now.getTime() ? "past" : "active";
  return {
    bundleId: row.packageId,
    bundleName: row.packageName,
    date: row.sessionDate,
    start: localTime(row.sessionStart, row.timezone),
    firstName: row.parentName.split(" ")[0],
    setups: setupsOf(row.packageInclusions ?? []),
    picks: saved?.picks ?? [],
    canChange: status === "active" && canChangeBackdrop(row, now),
    status,
    home: { ...homeOf(row.locationAddress), accessNotes: access?.notes ?? "" },
    babyNames: (babies.get(row.id) ?? [{ name: row.babyName ?? undefined }]).map((b) => b.name ?? ""),
    babyGenders: (babies.get(row.id) ?? []).map((b) => b.gender ?? ""),
    photos: Boolean(consent?.photos),
  };
}

async function rowFor(token: string): Promise<Booking> {
  const row = await findByCancelToken(token);
  if (!row) throw new BookingError("not_found", fill(en.backdropPage.invalid, { phone: site.contact.phone }));
  return row;
}

export async function getBackdropView(token: string): Promise<BackdropView> {
  return viewOf(await rowFor(token));
}

/**
 * Saves the family's details; returns the booking (updated), its backdrops before, and whether anything for the
 * calendar event changed (the studio email + Outlook follow after the response).
 */
export async function saveBackdropsWithToken(token: string, input: PrepareInput): Promise<{ view: BackdropView; row: Booking; before: string[]; changed: boolean }> {
  let row = await rowFor(token);
  if (!canChangeBackdrop(row)) throw new BookingError("reschedule_closed", closedText());
  const setups = setupsOf(row.packageInclusions ?? []);
  if (input.picks.length > setups) throw new BookingError("invalid_request", `Pick up to ${setups}.`);
  const old = await viewOf(row);
  const db = getDb();
  await saveBackdrops(row.id, input.picks, "family");
  let changed = old.picks.join() !== input.picks.join();
  if (input.home) {
    const line = formatAddress({ street: input.home.street.trim(), city: input.home.city.trim(), zip: old.home.zip });
    if (line !== row.locationAddress) {
      [row] = await db.update(bookings).set({ locationAddress: line, updatedAt: new Date() }).where(eq(bookings.id, row.id)).returning();
      changed = true;
    }
    const notes = input.home.accessNotes?.trim() ?? "";
    if (notes !== old.home.accessNotes) {
      await (notes
        ? db.insert(bookingAccess).values({ bookingId: row.id, notes }).onConflictDoUpdate({ target: bookingAccess.bookingId, set: { notes } })
        : db.delete(bookingAccess).where(eq(bookingAccess.bookingId, row.id)));
      changed = true;
    }
  }
  if (input.babyNames) {
    const names = old.babyNames.map((n, i) => input.babyNames![i]?.trim() ?? n);
    if (names.join("\n") !== old.babyNames.join("\n")) {
      await Promise.all(names.map((name, position) => db.update(bookingBabies).set({ name: name || null }).where(and(eq(bookingBabies.bookingId, row.id), eq(bookingBabies.position, position)))));
      [row] = await db.update(bookings).set({ babyName: names[0] || null, updatedAt: new Date() }).where(eq(bookings.id, row.id)).returning();
      changed = true;
    }
  }
  if (input.babyGenders && old.babyGenders.length) {
    const genders = old.babyGenders.map((g, i) => input.babyGenders![i] ?? g);
    await Promise.all(
      genders.map((gender, position) =>
        gender === old.babyGenders[position]
          ? null
          : gender
            ? db.insert(bookingBabyGenders).values({ bookingId: row.id, position, gender }).onConflictDoUpdate({ target: [bookingBabyGenders.bookingId, bookingBabyGenders.position], set: { gender } })
            : db.delete(bookingBabyGenders).where(and(eq(bookingBabyGenders.bookingId, row.id), eq(bookingBabyGenders.position, position))),
      ),
    );
    if (genders.join() !== old.babyGenders.join()) changed = true;
  }
  if (input.photos !== undefined && input.photos !== old.photos) {
    const photosAt = input.photos ? new Date() : null;
    await db.insert(bookingConsents).values({ bookingId: row.id, photos: input.photos, photosAt }).onConflictDoUpdate({ target: bookingConsents.bookingId, set: { photos: input.photos, photosAt } });
    changed = true;
  }
  return { view: await viewOf(row), row, before: old.picks, changed };
}

/** After a change: the studio email (backdrops changed), then the Outlook event rebuilt from the booking. Never throws. */
export async function afterBackdropChange(row: Booking, before: string[], after: string[]): Promise<void> {
  if (before.join() !== after.join()) {
    try {
      const mail = await internalBackdropEmail({ reference: row.bookingReference, parentName: row.parentName, email: row.email, phone: row.phone, bundleName: row.packageName, date: row.sessionDate, start: localTime(row.sessionStart, row.timezone), before, after });
      await sendEmail({ scope: "resend.internal", from: emailConfig().internalFrom, to: emailConfig().notify, subject: mail.subject, html: mail.html, text: mail.text, replyTo: row.email, idempotencyKey: `backdrop/${row.bookingReference}/${after.join("+") || "none"}/${Date.now()}`, reference: row.bookingReference });
    } catch (err) {
      log.error("backdrop", "Studio email not sent", { reference: row.bookingReference, error: err as Error });
    }
  }
  await refreshCalendarEvent(row).catch((err) => log.error("backdrop", "Outlook event not updated", { reference: row.bookingReference, error: err as Error }));
}

/** Rebuilds the Outlook event's description and location from the saved booking (same rows as when it was booked). */
async function refreshCalendarEvent(row: Booking): Promise<void> {
  if (!row.outlookEventId || row.status === "cancelled" || !isMicrosoftConfigured()) return;
  await updateCalendarEventBody(row.outlookEventId, eventBodyHtml(await detailsFromRow(row)), row.locationAddress);
}
