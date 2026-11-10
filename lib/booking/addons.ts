import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isBabyGender } from "@/config/booking";
import { bookingAddons, bookingBabies, bookingBabyGenders, bookingFamilyMembers } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { ADDON_KINDS, type AddonKind, type AddonLine, type BookingBaby } from "./extra-babies";
import { cleanFamily, type FamilyMember } from "./family";

/** Preserve safe driver metadata for the logger; it discards the value-filled Drizzle message. */
const reason = (err: unknown) => (err instanceof Error ? err : new Error("query failed"));

/** Best-effort detail rows. The money total also lives on `bookings`, so a missing detail table never changes a bill. */
export async function saveBookingAddons(bookingId: string, babies: BookingBaby[], addons: AddonLine[], reference: string): Promise<void> {
  const db = getDb();
  const writes = [
    db.insert(bookingBabies).values(babies.map((baby, position) => ({ bookingId, position, name: baby.name?.trim() || null, age: baby.age }))).onConflictDoNothing(),
    ...(addons.length
      ? [db.insert(bookingAddons).values(addons.map((addon) => ({ bookingId, kind: addon.kind, name: addon.name, quantity: addon.quantity, unitPriceCents: addon.unitPriceCents, totalPriceCents: addon.totalCents, extraMinutes: addon.extraMinutes, extraPhotos: addon.extraPhotos }))).onConflictDoNothing()]
      : []),
  ];
  const genders = babies.flatMap((baby, position) => (baby.gender ? [{ bookingId, position, gender: baby.gender }] : []));
  await Promise.all([
    db.batch(writes as never).catch((err) => log.error("booking.db", "Babies/add-on details not saved", { reference, error: reason(err) })),
    // separate write: a database without migration 0021 loses only the genders, never the rows above
    genders.length
      ? db.insert(bookingBabyGenders).values(genders).onConflictDoNothing().catch((err) => log.error("booking.db", "Baby genders not saved", { reference, error: reason(err) }))
      : null,
  ]);
}

export async function babiesFor(ids: string[]): Promise<Map<string, BookingBaby[]>> {
  const out = new Map<string, BookingBaby[]>();
  if (!ids.length) return out;
  const [rows, genderRows] = await Promise.all([
    getDb().select().from(bookingBabies).where(inArray(bookingBabies.bookingId, ids)).catch(() => []),
    getDb().select().from(bookingBabyGenders).where(inArray(bookingBabyGenders.bookingId, ids)).catch(() => []),
  ]);
  const genders = new Map(genderRows.map((g) => [`${g.bookingId}:${g.position}`, g.gender]));
  rows.sort((a, b) => a.position - b.position).forEach((r) => {
    const gender = genders.get(`${r.bookingId}:${r.position}`);
    out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), { name: r.name ?? undefined, age: r.age, ...(isBabyGender(gender) ? { gender } : {}) }]);
  });
  return out;
}

export async function addonsFor(ids: string[]): Promise<Map<string, AddonLine[]>> {
  const out = new Map<string, AddonLine[]>();
  if (!ids.length) return out;
  const rows = await getDb().select().from(bookingAddons).where(inArray(bookingAddons.bookingId, ids)).catch(() => []);
  rows.forEach((r) => {
    if (!ADDON_KINDS.includes(r.kind as AddonKind)) return;
    out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), { kind: r.kind as AddonKind, name: r.name, quantity: r.quantity, unitPriceCents: r.unitPriceCents, totalCents: r.totalPriceCents, extraMinutes: r.extraMinutes, extraPhotos: r.extraPhotos }]);
  });
  return out;
}

/** Who else is in the photos (migration 0025). Best effort: a database without the table only loses this list. */
export async function saveBookingFamily(bookingId: string, members: FamilyMember[], reference: string): Promise<void> {
  if (!members.length) return;
  await getDb()
    .insert(bookingFamilyMembers)
    .values(members.map((m, position) => ({ bookingId, position, role: m.role, name: m.name?.trim() || null })))
    .onConflictDoNothing()
    .catch((err) => log.error("booking.db", "Family members not saved", { reference, error: reason(err) }));
}

export async function familyFor(ids: string[]): Promise<Map<string, FamilyMember[]>> {
  const out = new Map<string, FamilyMember[]>();
  if (!ids.length) return out;
  const rows = await getDb().select().from(bookingFamilyMembers).where(inArray(bookingFamilyMembers.bookingId, ids)).catch(() => []);
  rows.sort((a, b) => a.position - b.position).forEach((r) => {
    out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), ...cleanFamily([{ role: r.role, name: r.name ?? undefined }])]);
  });
  return out;
}
