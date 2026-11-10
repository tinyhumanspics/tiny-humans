import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { babiesFor } from "@/lib/booking/addons";
import { getDb, isDatabaseConfigured, isUndefinedTable } from "@/lib/db/client";
import { bookingConsents, bookings, photoWaivers, type Booking, type PhotoWaiver } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { waiverFacts } from "./facts";
import { photosConsentOf, waiverSnapshot, WAIVER_USES, type WaiverLanguage, type WaiverSnapshot, type WaiverUses } from "./text";
import type { SignedWaiver, WaiverChild, WaiverContext, WaiverSummary } from "./types";
import { decodeSignature, type SignInput } from "./validation";

/**
 * Photo and video releases (/admin → Leads). Owner-only: routes check `isAdmin()` and parse input first. A signed
 * row is never edited or deleted here (the database refuses edits too: trigger in drizzle/0023_photo_waivers.sql).
 */

export class WaiverNotReadyError extends Error {
  constructor() {
    super("Run the photo waiver migration (drizzle/0023_photo_waivers.sql) in Neon first.");
  }
}
export class WaiverNotFoundError extends Error {}
export class WaiverInputError extends Error {}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  if (!isDatabaseConfigured()) throw new WaiverNotReadyError();
  try {
    return await fn();
  } catch (err) {
    if (isUndefinedTable(err)) throw new WaiverNotReadyError();
    throw err;
  }
}

const usesOf = (v: unknown): WaiverUses => Object.fromEntries(WAIVER_USES.map((k) => [k, Boolean((v as Record<string, unknown> | null)?.[k])])) as WaiverUses;

const summaryOf = (w: PhotoWaiver): WaiverSummary => ({
  id: w.id,
  status: w.status as WaiverSummary["status"],
  signedAt: w.signedAt.toISOString(),
  signerName: w.signerName,
  relationship: w.relationship as WaiverSummary["relationship"],
  uses: usesOf(w.uses),
  firstNameOk: w.firstNameOk,
  language: w.language as WaiverLanguage,
  revokedAt: w.revokedAt ? w.revokedAt.toISOString() : null,
});

async function bookingByReference(reference: string): Promise<Booking | null> {
  const [row] = await getDb().select().from(bookings).where(eq(bookings.bookingReference, reference)).limit(1);
  return row ?? null;
}

async function childrenOf(row: Booking): Promise<WaiverChild[]> {
  const babies = (await babiesFor([row.id])).get(row.id);
  return babies?.length ? babies.map((b) => ({ name: b.name?.trim() || null, age: b.age })) : [{ name: row.babyName?.trim() || null, age: row.babyAge }];
}

async function activeFor(bookingId: string): Promise<PhotoWaiver | null> {
  const [w] = await getDb().select().from(photoWaivers).where(and(eq(photoWaivers.bookingId, bookingId), eq(photoWaivers.status, "signed"))).limit(1);
  return w ?? null;
}

/** What the signing screen shows about the booking (and whether a release is signed already). */
export async function waiverContext(reference: string): Promise<WaiverContext> {
  return guard(async () => {
    const row = await bookingByReference(reference);
    if (!row) throw new WaiverNotFoundError("That booking doesn't exist.");
    const [children, active] = await Promise.all([childrenOf(row), activeFor(row.id)]);
    return {
      reference: row.bookingReference,
      status: row.status,
      parentName: row.parentName,
      children,
      sessionDate: row.sessionDate,
      locale: row.locale === "es" ? "es" : "en",
      signed: active ? summaryOf(active) : null,
    };
  });
}

/**
 * Saves a signed release: the text is rebuilt here from the version + language (never taken from the browser) and
 * hashed; an earlier active release becomes "superseded"; the booking's "Photo use" follows the choices. One batch:
 * all of it is saved or none.
 */
export async function signWaiver(input: SignInput, userAgent: string | null): Promise<{ id: string; signedAt: string }> {
  return guard(async () => {
    const row = await bookingByReference(input.reference);
    if (!row) throw new WaiverNotFoundError("That booking doesn't exist.");
    if (row.status === "cancelled") throw new WaiverInputError("This booking was cancelled, so it can't get a photo release.");
    const signature = decodeSignature(input.signature);
    if (!signature) throw new WaiverInputError("Please sign again.");
    const children = await childrenOf(row);
    const snapshot = waiverSnapshot(input.language, waiverFacts({ parentName: row.parentName, children, sessionDate: row.sessionDate }, input.language));
    const textSha256 = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const now = new Date();
    const photos = photosConsentOf(input.uses);
    const db = getDb();
    const [, inserted] = await db.batch([
      db.update(photoWaivers).set({ status: "superseded" }).where(and(eq(photoWaivers.bookingId, row.id), eq(photoWaivers.status, "signed"))),
      db
        .insert(photoWaivers)
        .values({
          bookingId: row.id,
          bookingReference: row.bookingReference,
          familyName: row.parentName,
          children,
          sessionDate: row.sessionDate,
          version: snapshot.version,
          language: input.language,
          textSnapshot: snapshot,
          textSha256,
          uses: input.uses,
          firstNameOk: snapshot.firstName ? input.firstNameOk : false,
          signerName: input.signerName.trim(),
          relationship: input.relationship,
          signaturePng: signature.base64,
          signedAt: now,
          userAgent: userAgent?.slice(0, 400) ?? null,
        })
        .returning({ id: photoWaivers.id, signedAt: photoWaivers.signedAt }),
      db
        .insert(bookingConsents)
        .values({ bookingId: row.id, photos, photosAt: now })
        .onConflictDoUpdate({ target: bookingConsents.bookingId, set: { photos, photosAt: now, updatedAt: now } }),
    ]);
    const saved = inserted[0];
    return { id: saved.id, signedAt: saved.signedAt.toISOString() };
  });
}

/** The latest release of each booking for Leads: the active one, else the most recent revoked one. Best effort. */
export async function waiversForBookings(bookingIds: string[]): Promise<Map<string, WaiverSummary>> {
  const out = new Map<string, WaiverSummary>();
  if (!bookingIds.length || !isDatabaseConfigured()) return out;
  try {
    const rows = await getDb()
      .select()
      .from(photoWaivers)
      .where(and(inArray(photoWaivers.bookingId, bookingIds), inArray(photoWaivers.status, ["signed", "revoked"])))
      .orderBy(desc(photoWaivers.signedAt));
    for (const w of rows) {
      const current = out.get(w.bookingId!);
      if (!current || (current.status !== "signed" && w.status === "signed")) out.set(w.bookingId!, summaryOf(w));
    }
  } catch (err) {
    if (!isUndefinedTable(err)) log.error("waiver", "Could not load photo releases", { error: err as Error });
  }
  return out;
}

/** A signed release with its text and signature ("See signed waiver"). */
export async function getSignedWaiver(id: string): Promise<SignedWaiver | null> {
  return guard(async () => {
    const [w] = await getDb().select().from(photoWaivers).where(eq(photoWaivers.id, id)).limit(1);
    if (!w) return null;
    return {
      ...summaryOf(w),
      reference: w.bookingReference,
      familyName: w.familyName,
      children: (w.children ?? []) as WaiverChild[],
      sessionDate: w.sessionDate,
      version: w.version,
      snapshot: w.textSnapshot as WaiverSnapshot,
      sha256: w.textSha256,
      signature: `data:image/png;base64,${w.signaturePng}`,
      revokeNote: w.revokeNote,
      bookingExists: w.bookingId !== null,
    };
  });
}

/**
 * The family changed their mind ("Keep their photos private" in Leads): the active release is marked revoked with
 * the date, and kept. Best effort: no table yet = nothing to revoke.
 */
export async function revokeWaiverForBooking(bookingId: string, note: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await getDb()
      .update(photoWaivers)
      .set({ status: "revoked", revokedAt: sql`now()`, revokeNote: note.slice(0, 300) })
      .where(and(eq(photoWaivers.bookingId, bookingId), eq(photoWaivers.status, "signed")));
  } catch (err) {
    if (!isUndefinedTable(err)) throw err;
  }
}
