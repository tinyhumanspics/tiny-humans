import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookingAddons, bookingBabies } from "@/lib/db/schema";
import { log } from "@/lib/log";
import type { AddonLine, BookingBaby } from "./extra-babies";

/** Preserve safe driver metadata for the logger; it discards the value-filled Drizzle message. */
const reason = (err: unknown) => (err instanceof Error ? err : new Error("query failed"));

/** Best-effort detail rows. The money total also lives on `bookings`, so a missing detail table never changes a bill. */
export async function saveBookingAddons(bookingId: string, babies: BookingBaby[], addon: AddonLine | null, reference: string): Promise<void> {
  const db = getDb();
  const writes = [
    db.insert(bookingBabies).values(babies.map((baby, position) => ({ bookingId, position, name: baby.name?.trim() || null, age: baby.age }))).onConflictDoNothing(),
    ...(addon
      ? [db.insert(bookingAddons).values({ bookingId, kind: addon.kind, name: addon.name, quantity: addon.quantity, unitPriceCents: addon.unitPriceCents, totalPriceCents: addon.totalCents, extraMinutes: addon.extraMinutes, extraPhotos: addon.extraPhotos }).onConflictDoNothing()]
      : []),
  ];
  await db.batch(writes as never).catch((err) => log.error("booking.db", "Babies/add-on details not saved", { reference, error: reason(err) }));
}

export async function babiesFor(ids: string[]): Promise<Map<string, BookingBaby[]>> {
  const out = new Map<string, BookingBaby[]>();
  if (!ids.length) return out;
  const rows = await getDb().select().from(bookingBabies).where(inArray(bookingBabies.bookingId, ids)).catch(() => []);
  rows.sort((a, b) => a.position - b.position).forEach((r) => out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), { name: r.name ?? undefined, age: r.age }]));
  return out;
}

export async function addonsFor(ids: string[]): Promise<Map<string, AddonLine[]>> {
  const out = new Map<string, AddonLine[]>();
  if (!ids.length) return out;
  const rows = await getDb().select().from(bookingAddons).where(inArray(bookingAddons.bookingId, ids)).catch(() => []);
  rows.forEach((r) => {
    if (r.kind !== "extra_baby") return;
    out.set(r.bookingId, [...(out.get(r.bookingId) ?? []), { kind: r.kind, name: r.name, quantity: r.quantity, unitPriceCents: r.unitPriceCents, totalCents: r.totalPriceCents, extraMinutes: r.extraMinutes, extraPhotos: r.extraPhotos }]);
  });
  return out;
}
