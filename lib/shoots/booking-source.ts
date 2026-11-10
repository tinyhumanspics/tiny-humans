import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { portfolio } from "@/config/portfolio";
import { addonsFor, babiesFor, familyFor } from "@/lib/booking/addons";
import { backdropsFor } from "@/lib/booking/backdrops";
import { addressOf } from "@/lib/booking/details";
import { getDb } from "@/lib/db/client";
import { bookings, type Booking } from "@/lib/db/schema";
import { depositsFor } from "@/lib/deposit/server";
import { log } from "@/lib/log";
import { allMediaPhotos } from "@/lib/settings/defaults";
import { getSiteSettings } from "@/lib/settings/server";
import { bookingFacts, type BookingSource } from "./from-bookings";
import type { ShootBookingFacts, ShootBookingStatus, ShootDeposit } from "./types";

/** Loads bookings with their extras for Shoots (the Tiny Humans side of the adapter; mapping in from-bookings.ts). */

/** Bookings that appear as shoots by themselves (spec §3). Cancelled ones never show on a list or day sheet. */
const ACTIVE: ShootBookingStatus[] = ["pending", "confirmed", "rescheduled"];
const DEPOSIT_STATUSES = new Set<ShootDeposit["status"]>(["pending", "paid", "refunded", "expired", "unpaid"]);

type SitePhoto = { id: string; title?: string; src: string };

/** Site photos a family can pick while booking (every theme's pictures + the portfolio). */
async function sitePhotos(): Promise<SitePhoto[]> {
  try {
    return [...allMediaPhotos(await getSiteSettings()), ...portfolio];
  } catch (err) {
    log.error("shoots", "Could not load site photos for picks", { error: err as Error });
    return portfolio;
  }
}

async function factsOf(rows: Booking[]): Promise<ShootBookingFacts[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [backdrops, babies, addons, deposits, photos, family] = await Promise.all([
    backdropsFor(ids),
    babiesFor(ids),
    addonsFor(ids),
    depositsFor(ids),
    rows.some((r) => r.inspirationPhotoId) ? sitePhotos() : Promise.resolve([] as SitePhoto[]),
    familyFor(ids),
  ]);
  const picksOf = new Map(backdrops.map((b) => [b.bookingId, b.picks]));
  const depositOf = new Map(deposits.map((d) => [d.bookingId, d]));
  return rows.map((r) => {
    const photo = r.inspirationPhotoId ? photos.find((p) => p?.id === r.inspirationPhotoId) : undefined;
    const deposit = depositOf.get(r.id);
    const source: BookingSource = {
      id: r.id,
      reference: r.bookingReference,
      status: r.status,
      parentName: r.parentName,
      sessionDate: r.sessionDate,
      sessionStart: r.sessionStart,
      sessionEnd: r.sessionEnd,
      timezone: r.timezone,
      packageName: r.packageName,
      packageInclusions: r.packageInclusions ?? null,
      babyName: r.babyName,
      babyAge: r.babyAge,
      babies: babies.get(r.id) ?? [],
      family: family.get(r.id) ?? [],
      backdropPicks: picksOf.get(r.id) ?? [],
      addons: (addons.get(r.id) ?? []).map((a) => ({ name: a.name, quantity: a.quantity, extraMinutes: a.extraMinutes })),
      pick: photo ? { id: photo.id, title: photo.title?.trim() || "Their pick", src: photo.src } : null,
      notes: r.notes,
      address: r.locationAddress,
      city: addressOf(r.locationAddress).city,
      deposit: deposit && DEPOSIT_STATUSES.has(deposit.status as ShootDeposit["status"]) ? { status: deposit.status as ShootDeposit["status"], amountCents: deposit.amountCents } : null,
    };
    return bookingFacts(source);
  });
}

/** Active bookings with a session between `from` and `to` (Miami days, inclusive). */
export async function bookingShootsBetween(from: string, to: string): Promise<ShootBookingFacts[]> {
  const rows = await getDb()
    .select()
    .from(bookings)
    .where(and(gte(bookings.sessionDate, from), lte(bookings.sessionDate, to), inArray(bookings.status, ACTIVE)));
  return factsOf(rows);
}

/** One booking by reference, whatever its status (a cancelled booking's folder can still be opened). */
export async function bookingShootByReference(reference: string): Promise<ShootBookingFacts | null> {
  const rows = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return (await factsOf(rows))[0] ?? null;
}

/** Bookings by id (for shoot rows), whatever their status. */
export async function bookingShootsById(ids: string[]): Promise<Map<string, ShootBookingFacts>> {
  if (!ids.length) return new Map();
  const rows = await getDb().select().from(bookings).where(inArray(bookings.id, ids));
  return new Map((await factsOf(rows)).map((f) => [f.bookingId, f]));
}
