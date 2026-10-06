import "server-only";
import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Bundle } from "@/config/bundles";
import { builtInCatalog } from "./catalog";
export { builtInCatalog };
import { bookingRules } from "@/config/booking";
import { getDb, isDatabaseConfigured, isUniqueViolation } from "@/lib/db/client";
import { bookings, bundleInclusions, bundlesTable, discountCodeBundles, discountCodes, discountCodeUsage } from "@/lib/db/schema";
import { log } from "@/lib/log";
import { BookingError } from "@/lib/booking/errors";
import { todayInZone } from "@/lib/booking/timezone";
import { durationLabel, toCents } from "./engine";
import { CODE_MESSAGES, type CodeCheck, type DiscountCode, type PricingAdapter } from "./types";
import type { BundleInput, CodeInput } from "./validation";

export const CATALOG_TAG = "catalog";
const LOCATION = "We bring the studio to your home";

const missingTable = (err: unknown) => JSON.stringify(err ?? "").includes("42P01") || String((err as Error)?.message ?? "").includes("does not exist");


/** Every bundle (active + inactive), from Neon; built-in bundles until the database/migration exists. */
export async function getCatalog(): Promise<Bundle[]> {
  if (!isDatabaseConfigured()) return builtInCatalog();
  try {
    const db = getDb();
    const [rows, inc] = await Promise.all([
      db.select().from(bundlesTable).orderBy(asc(bundlesTable.sortOrder), asc(bundlesTable.createdAt)),
      db.select().from(bundleInclusions).orderBy(asc(bundleInclusions.position)),
    ]);
    if (!rows.length) return builtInCatalog();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.regularPriceCents / 100,
      duration: r.durationLabel || durationLabel(r.durationMinutes),
      durationMinutes: r.durationMinutes,
      people: "",
      setups: "",
      photos: r.photosLabel ?? "",
      features: inc.filter((i) => i.bundleId === r.id).map((i) => i.text),
      locationNote: LOCATION,
      cta: `Choose ${r.name}`,
      badge: r.badge ?? undefined,
      description: r.description ?? undefined,
      active: r.active,
      sortOrder: r.sortOrder,
      offer: r.offerEnabled || r.offerPriceCents != null ? { enabled: r.offerEnabled, price: (r.offerPriceCents ?? 0) / 100, label: r.offerLabel, endsOn: r.offerEndsOn } : null,
    }));
  } catch (err) {
    if (missingTable(err)) {
      log.warn("pricing", "Pricing tables not found: using built-in bundles. Run drizzle/0005_pricing_and_promotions.sql in Neon.");
      return builtInCatalog();
    }
    log.error("pricing.db", "Could not load bundles", { error: err as Error });
    throw err;
  }
}

/** Active bundles for the public site (cached; refreshed when the owner saves, and every 5 minutes). */
export async function getPublicCatalog(): Promise<Bundle[]> {
  try {
    const { unstable_cache } = await import("next/cache");
    return await unstable_cache(async () => (await getCatalog()).filter((b) => b.active !== false), ["public-catalog"], { tags: [CATALOG_TAG], revalidate: 300 })();
  } catch {
    return (await getCatalog().catch(() => builtInCatalog())).filter((b) => b.active !== false);
  }
}

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "bundle";

export async function saveBundle(input: BundleInput): Promise<string> {
  const db = getDb();
  const id = input.id || `${slug(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const offer = input.offer;
  const values = {
    id,
    name: input.name,
    description: input.description || null,
    regularPriceCents: toCents(input.price),
    durationMinutes: input.durationMinutes,
    durationLabel: durationLabel(input.durationMinutes),
    photosLabel: input.photos || null,
    badge: input.badge || null,
    active: input.active,
    sortOrder: input.sortOrder ?? 0,
    offerEnabled: Boolean(offer?.enabled),
    offerPriceCents: offer && offer.price > 0 && toCents(offer.price) < toCents(input.price) ? toCents(offer.price) : null,
    offerLabel: offer?.label || null,
    offerEndsOn: offer?.endsOn || null,
    updatedAt: new Date(),
  };
  const { id: _omit, ...update } = values;
  await db.batch([
    db.insert(bundlesTable).values(values).onConflictDoUpdate({ target: bundlesTable.id, set: update }),
    db.delete(bundleInclusions).where(eq(bundleInclusions.bundleId, id)),
    ...(input.features.length ? [db.insert(bundleInclusions).values(input.features.map((text, position) => ({ bundleId: id, position, text })))] : []),
  ] as never);
  return id;
}

export class BundleInUseError extends Error {}

/** Permanent delete only when no booking has ever used the bundle (otherwise deactivate). */
export async function deleteBundle(id: string): Promise<void> {
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(bookings).where(eq(bookings.packageId, id));
  if (Number(n) > 0) throw new BundleInUseError(`This bundle has ${n} booking${Number(n) === 1 ? "" : "s"} in its history, so it can't be deleted. Turn it off (inactive) instead.`);
  await db.delete(bundlesTable).where(eq(bundlesTable.id, id));
}

/* ---------------- discount codes ---------------- */

export async function listCodes(): Promise<DiscountCode[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const [rows, links] = await Promise.all([db.select().from(discountCodes).orderBy(asc(discountCodes.createdAt)), db.select().from(discountCodeBundles)]);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.discountType as "percent" | "fixed",
    value: r.discountType === "fixed" ? r.discountValue / 100 : r.discountValue,
    bundleIds: links.filter((l) => l.codeId === r.id).map((l) => l.bundleId),
    active: r.active,
    expiresOn: r.expiresOn,
    maxUses: r.maxUses,
    onePerEmail: r.onePerEmail,
    internalNote: r.internalNote,
    usesCount: r.usesCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function saveCode(input: CodeInput): Promise<string> {
  const db = getDb();
  const values = {
    code: input.code.trim().toUpperCase(),
    discountType: input.type,
    discountValue: input.type === "fixed" ? toCents(input.value) : Math.round(input.value),
    active: input.active,
    expiresOn: input.expiresOn || null,
    maxUses: input.maxUses ?? null,
    onePerEmail: input.onePerEmail,
    internalNote: input.internalNote || null,
    updatedAt: new Date(),
  };
  let id = input.id;
  try {
    if (id) await db.update(discountCodes).set(values).where(eq(discountCodes.id, id));
    else [{ id }] = await db.insert(discountCodes).values(values).returning({ id: discountCodes.id });
  } catch (err) {
    if (isUniqueViolation(err)) throw new BookingError("invalid_request", "A code with that name already exists.");
    throw err;
  }
  await db.batch([db.delete(discountCodeBundles).where(eq(discountCodeBundles.codeId, id!)), db.insert(discountCodeBundles).values(input.bundleIds.map((bundleId) => ({ codeId: id!, bundleId })))] as never);
  return id!;
}

/** Removes the code. Bookings keep their own copy of the code and amount, so history is untouched. */
export async function deleteCode(id: string): Promise<void> {
  await getDb().delete(discountCodes).where(eq(discountCodes.id, id));
}

/** Server-side code check (never trusts the browser). */
export async function validateCode(raw: string, bundleId: string, email?: string): Promise<CodeCheck> {
  if (!isDatabaseConfigured()) return { ok: false, message: CODE_MESSAGES.notFound };
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { ok: false, message: CODE_MESSAGES.notFound };
  const db = getDb();
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1);
  if (!row) return { ok: false, message: CODE_MESSAGES.notFound };
  if (!row.active) return { ok: false, message: CODE_MESSAGES.inactive };
  if (row.expiresOn && todayInZone(bookingRules.timeZone) > row.expiresOn) return { ok: false, message: CODE_MESSAGES.expired };
  const [link] = await db.select().from(discountCodeBundles).where(and(eq(discountCodeBundles.codeId, row.id), eq(discountCodeBundles.bundleId, bundleId))).limit(1);
  if (!link) return { ok: false, message: CODE_MESSAGES.notForBundle };
  if (row.maxUses != null && row.usesCount >= row.maxUses) return { ok: false, message: CODE_MESSAGES.maxed };
  if (row.onePerEmail && email) {
    const [used] = await db.select({ id: discountCodeUsage.id }).from(discountCodeUsage).where(and(eq(discountCodeUsage.codeId, row.id), eq(discountCodeUsage.emailKey, email.trim().toLowerCase()))).limit(1);
    if (used) return { ok: false, message: CODE_MESSAGES.usedByEmail };
  }
  return { ok: true, codeId: row.id, terms: { code: row.code, type: row.discountType as "percent" | "fixed", value: row.discountValue } };
}

/**
 * Reserve one use atomically: the uses counter only increments while under the
 * limit (so simultaneous bookings can't exceed it), and the usage row's unique
 * index enforces one-per-email. Returns a release function for rollbacks.
 */
export async function claimCode(codeId: string, email: string): Promise<{ usageId: string; release: () => Promise<void> }> {
  const db = getDb();
  const [claimed] = await db
    .update(discountCodes)
    .set({ usesCount: sql`${discountCodes.usesCount} + 1` })
    .where(and(eq(discountCodes.id, codeId), eq(discountCodes.active, true), or(isNull(discountCodes.maxUses), lt(discountCodes.usesCount, discountCodes.maxUses))))
    .returning({ onePerEmail: discountCodes.onePerEmail });
  if (!claimed) throw new BookingError("invalid_request", CODE_MESSAGES.maxed);
  const undoCount = () => db.update(discountCodes).set({ usesCount: sql`greatest(${discountCodes.usesCount} - 1, 0)` }).where(eq(discountCodes.id, codeId));
  try {
    const [u] = await db
      .insert(discountCodeUsage)
      .values({ codeId, email: email.trim(), emailKey: claimed.onePerEmail ? email.trim().toLowerCase() : null })
      .returning({ id: discountCodeUsage.id });
    return {
      usageId: u.id,
      release: async () => {
        await db.delete(discountCodeUsage).where(eq(discountCodeUsage.id, u.id)).catch(() => undefined);
        await undoCount().catch(() => undefined);
      },
    };
  } catch (err) {
    await undoCount().catch(() => undefined);
    if (isUniqueViolation(err)) throw new BookingError("invalid_request", CODE_MESSAGES.usedByEmail);
    throw err;
  }
}

export async function attachUsage(usageId: string, bookingId: string) {
  await getDb().update(discountCodeUsage).set({ bookingId }).where(eq(discountCodeUsage.id, usageId)).catch(() => undefined);
}

/** Pricing for the server-side providers. */
export const serverPricing: PricingAdapter = {
  bundles: getCatalog,
  validateCode,
  claimCode: (codeId, email) => claimCode(codeId, email),
};
