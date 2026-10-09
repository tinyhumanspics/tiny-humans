import "server-only";
import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { AdminBundle, Bundle } from "@/config/bundles";
import { builtInCatalog } from "./catalog";
export { builtInCatalog };
import { bookingRules } from "@/config/booking";
import { getDb, isDatabaseConfigured, isUniqueViolation } from "@/lib/db/client";
import {
  bookings,
  bundleAddons,
  bundleInclusionTranslations,
  bundleInclusions,
  bundleTranslations,
  bundlesTable,
  discountCodeBundles,
  discountCodes,
  discountCodeUsage,
} from "@/lib/db/schema";
import { log } from "@/lib/log";
import { BookingError } from "@/lib/booking/errors";
import { todayInZone } from "@/lib/booking/timezone";
import { durationLabel, toCents } from "./engine";
import { lastGoodCatalog, rememberCatalog } from "./snapshot";
import { CODE_MESSAGES, type CodeCheck, type DiscountCode, type PricingAdapter } from "./types";
import type { BundleInput, CodeInput } from "./validation";

export const CATALOG_TAG = "catalog";
const LOCATION = "We bring the studio to your home";

const missingTable = (err: unknown) => JSON.stringify(err ?? "").includes("42P01") || String((err as Error)?.message ?? "").includes("does not exist");


export class CatalogUnavailableError extends Error {}

/**
 * Every bundle (active + inactive), from Neon. The built-in bundles in
 * config/bundles.ts are used ONLY when no database is configured (local
 * development / prototype). With a database, an error or an empty table throws:
 * production never shows hardcoded prices the server wouldn't honor.
 */
export async function getCatalog(): Promise<Bundle[]> {
  if (!isDatabaseConfigured()) return builtInCatalog();
  let rows: (typeof bundlesTable.$inferSelect)[];
  let inc: (typeof bundleInclusions.$inferSelect)[];
  let addons: (typeof bundleAddons.$inferSelect)[];
  try {
    const db = getDb();
    [rows, inc, addons] = await Promise.all([
      db.select().from(bundlesTable).orderBy(asc(bundlesTable.sortOrder), asc(bundlesTable.createdAt)),
      db.select().from(bundleInclusions).orderBy(asc(bundleInclusions.position)),
      db.select().from(bundleAddons).orderBy(asc(bundleAddons.sortOrder)),
    ]);
  } catch (err) {
    if (missingTable(err)) log.error("pricing.db", "Pricing/add-on tables not found. Run migrations 0005 and 0017 in Neon.");
    else log.error("pricing.db", "Could not load bundles", { error: err as Error });
    throw new CatalogUnavailableError("Bundles could not be loaded");
  }
  if (!rows.length) {
    log.error("pricing.db", "The bundles table is empty");
    throw new CatalogUnavailableError("No bundles in the database");
  }
  return rows.map((r) => {
    const extra = addons.find((a) => a.bundleId === r.id && a.kind === "extra_baby");
    return ({
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
    extraBaby: extra ? { active: extra.active, price: extra.unitPriceCents / 100, extraMinutes: extra.extraMinutes, extraPhotos: extra.extraPhotos, maxBabies: extra.maxQuantity + 1 } : null,
  });
  });
}

/** Owner-only catalog: the live English bundle plus its editable Spanish draft, if one has been saved. */
export async function getAdminCatalog(): Promise<AdminBundle[]> {
  const catalog = await getCatalog();
  if (!isDatabaseConfigured()) return catalog.map((bundle) => ({ ...bundle, spanish: null }));
  try {
    const db = getDb();
    const [translations, inclusions] = await Promise.all([
      db.select().from(bundleTranslations).where(eq(bundleTranslations.locale, "es")),
      db
        .select()
        .from(bundleInclusionTranslations)
        .where(eq(bundleInclusionTranslations.locale, "es"))
        .orderBy(asc(bundleInclusionTranslations.position)),
    ]);
    return catalog.map((bundle) => {
      const translated = translations.find((row) => row.bundleId === bundle.id);
      if (!translated) return { ...bundle, spanish: null };
      return {
        ...bundle,
        spanish: {
          name: translated.name,
          description: translated.description ?? undefined,
          badge: translated.badge ?? undefined,
          offerLabel: translated.offerLabel ?? undefined,
          features: inclusions.filter((row) => row.bundleId === bundle.id).map((row) => row.text),
        },
      };
    });
  } catch (err) {
    if (missingTable(err)) log.error("pricing.db", "Bundle translation tables not found. Run migration 0019 in Neon.");
    else log.error("pricing.db", "Could not load bundle translations", { error: err as Error });
    throw new CatalogUnavailableError("Bundle translations could not be loaded");
  }
}

/**
 * What the public site shows.
 * - live: from Neon (cached; refreshed when the owner saves, and every 5 minutes)
 * - snapshot: Neon is unreachable, so the last good copy (memory / Blob) is shown — the prices the owner last published
 * - builtin: no database configured (local development / prototype only)
 * With a database and no good copy, this throws on purpose: pages are statically regenerated (ISR), so Next keeps
 * serving the last good page, and a build fails instead of deploying wrong prices (the previous deployment stays live).
 * It never falls back to the hardcoded bundles in production.
 */
export type CatalogStatus = "live" | "snapshot" | "builtin";
export interface PublicCatalog {
  bundles: Bundle[];
  status: CatalogStatus;
}

const activeOnly = (list: Bundle[]) => list.filter((b) => b.active !== false);

export async function getPublicCatalog(): Promise<PublicCatalog> {
  if (!isDatabaseConfigured()) return { bundles: activeOnly(builtInCatalog()), status: "builtin" };
  try {
    const { unstable_cache } = await import("next/cache");
    const bundles = await unstable_cache(
      async () => {
        const list = activeOnly(await getCatalog());
        await rememberCatalog(list);
        return list;
      },
      ["public-catalog-v3"],
      { tags: [CATALOG_TAG], revalidate: 300 },
    )();
    return { bundles, status: "live" };
  } catch (err) {
    const copy = await lastGoodCatalog();
    if (copy) {
      log.error("pricing.catalog", "Live bundles unavailable: showing the last good copy", { error: err as Error });
      return { bundles: copy, status: "snapshot" };
    }
    log.error("pricing.catalog", "Live bundles unavailable and no saved copy: keeping the last good page", { error: err as Error });
    throw err;
  }
}

/** After the owner changes bundles: store the new public list as the last good copy. */
export async function refreshCatalogSnapshot(): Promise<void> {
  try {
    await rememberCatalog(activeOnly(await getCatalog()));
  } catch {
    /* logged in getCatalog */
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
  void _omit;
  const extraBaby = input.extraBaby;
  const spanish = input.spanish;
  await db.batch([
    db.insert(bundlesTable).values(values).onConflictDoUpdate({ target: bundlesTable.id, set: update }),
    db.delete(bundleInclusions).where(eq(bundleInclusions.bundleId, id)),
    ...(input.features.length ? [db.insert(bundleInclusions).values(input.features.map((text, position) => ({ bundleId: id, position, text })))] : []),
    db
      .insert(bundleAddons)
      .values({ bundleId: id, kind: "extra_baby", name: "Extra baby", active: extraBaby.active, unitPriceCents: toCents(extraBaby.price), extraMinutes: extraBaby.extraMinutes, extraPhotos: extraBaby.extraPhotos, maxQuantity: extraBaby.maxBabies - 1, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [bundleAddons.bundleId, bundleAddons.kind], set: { active: extraBaby.active, unitPriceCents: toCents(extraBaby.price), extraMinutes: extraBaby.extraMinutes, extraPhotos: extraBaby.extraPhotos, maxQuantity: extraBaby.maxBabies - 1, updatedAt: new Date() } }),
    db
      .delete(bundleInclusionTranslations)
      .where(and(eq(bundleInclusionTranslations.bundleId, id), eq(bundleInclusionTranslations.locale, "es"))),
    ...(spanish
      ? [
          db
            .insert(bundleTranslations)
            .values({
              bundleId: id,
              locale: "es",
              name: spanish.name,
              description: spanish.description || null,
              badge: spanish.badge || null,
              offerLabel: spanish.offerLabel || null,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [bundleTranslations.bundleId, bundleTranslations.locale],
              set: {
                name: spanish.name,
                description: spanish.description || null,
                badge: spanish.badge || null,
                offerLabel: spanish.offerLabel || null,
                updatedAt: new Date(),
              },
            }),
          ...(spanish.features.length
            ? [
                db.insert(bundleInclusionTranslations).values(
                  spanish.features.map((text, position) => ({ bundleId: id, locale: "es", position, text, updatedAt: new Date() })),
                ),
              ]
            : []),
        ]
      : [db.delete(bundleTranslations).where(and(eq(bundleTranslations.bundleId, id), eq(bundleTranslations.locale, "es")))]),
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

/** Gives back the code use of a booking that never happened (its deposit wasn't paid). */
export async function releaseCodeUsage(bookingId: string): Promise<void> {
  const db = getDb();
  const freed = await db.delete(discountCodeUsage).where(eq(discountCodeUsage.bookingId, bookingId)).returning({ codeId: discountCodeUsage.codeId });
  for (const u of freed) await db.update(discountCodes).set({ usesCount: sql`greatest(${discountCodes.usesCount} - 1, 0)` }).where(eq(discountCodes.id, u.codeId));
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
