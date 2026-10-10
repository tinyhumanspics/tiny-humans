import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { bookingDeposits, bundleDeposits, depositSettingsTable, type BookingDeposit } from "@/lib/db/schema";
import { getPublicCatalog } from "@/lib/pricing/server";
import { log } from "@/lib/log";
import { depositAmountFor, depositLabel, type BookingDepositInfo, type DepositSettings } from "./types";
import type { SiteDeposit } from "./copy";

/** The logger keeps only safe error metadata (code/table/constraint), never Drizzle's value-filled message. */
export const dbReason = (err: unknown) => (err instanceof Error ? err : new Error("query failed"));

/** "relation does not exist": the migration hasn't run yet (deposits stay off quietly). */
export const isMissingTable = (err: unknown) => (err as { cause?: { code?: string } })?.cause?.code === "42P01" || /does not exist/.test(String((err as Error)?.message ?? ""));

/** The owner's deposits (switch + per-bundle amounts); off when nothing is saved yet. Null: no database / table missing. */
export async function getDepositSettings(): Promise<DepositSettings | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const db = getDb();
    const [[row], amounts] = await Promise.all([db.select().from(depositSettingsTable).where(eq(depositSettingsTable.id, 1)).limit(1), db.select().from(bundleDeposits)]);
    return { enabled: row?.enabled ?? false, amounts: Object.fromEntries(amounts.map((a) => [a.bundleId, a.amountCents])), updatedAt: row?.updatedAt.toISOString() };
  } catch (err) {
    if (!isMissingTable(err)) log.error("deposit", "Could not load the deposit settings (no deposit)", { error: dbReason(err) });
    return null;
  }
}

/** A bundle's deposit for new bookings right now (null = deposits off). */
export async function depositOfferFor(bundleId: string): Promise<number | null> {
  const s = await getDepositSettings();
  return s?.enabled ? depositAmountFor(bundleId, s) : null;
}

/** For the website's wording: the deposit of every bookable bundle ("$50"), or "from" the smallest. Null = off. */
export async function siteDeposit(): Promise<SiteDeposit | null> {
  const s = await getDepositSettings();
  if (!s?.enabled) return null;
  const { bundles } = await getPublicCatalog().catch(() => ({ bundles: [] as { id: string; active?: boolean }[] }));
  return depositLabel(s, bundles.filter((b) => b.active !== false).map((b) => b.id));
}

/** Saves the switch and the amounts together (one atomic batch). */
export async function saveDepositSettings(s: { enabled: boolean; amounts: Record<string, number> }): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db.batch([
    db.insert(depositSettingsTable).values({ id: 1, enabled: s.enabled, updatedAt: now }).onConflictDoUpdate({ target: depositSettingsTable.id, set: { enabled: s.enabled, updatedAt: now } }),
    ...Object.entries(s.amounts).map(([bundleId, amountCents]) =>
      db.insert(bundleDeposits).values({ bundleId, amountCents, updatedAt: now }).onConflictDoUpdate({ target: bundleDeposits.bundleId, set: { amountCents, updatedAt: now } }),
    ),
  ]);
}

/** The booking's deposit row (null: booked without a deposit, or the table is missing). */
export async function depositOf(bookingId: string): Promise<BookingDeposit | null> {
  const [row] = await getDb()
    .select()
    .from(bookingDeposits)
    .where(eq(bookingDeposits.bookingId, bookingId))
    .limit(1)
    .catch((err) => {
      log.error("deposit", "Could not load a deposit", { error: dbReason(err) });
      return [];
    });
  return row ?? null;
}

/** Deposits of these bookings (empty if the table isn't there yet). */
export async function depositsFor(bookingIds: string[]): Promise<BookingDeposit[]> {
  if (!bookingIds.length) return [];
  return getDb()
    .select()
    .from(bookingDeposits)
    .where(inArray(bookingDeposits.bookingId, bookingIds))
    .catch((err) => {
      log.error("deposit", "Could not load deposits", { error: dbReason(err) });
      return [];
    });
}

/** Money the family has paid toward the session through the deposit (refunded = 0). */
export const depositPaidCents = (d: Pick<BookingDeposit, "status" | "amountCents"> | null | undefined) => (d?.status === "paid" ? d.amountCents : 0);

/** What the family's emails and pages say about the deposit (null: booked without one). */
export function depositInfoOf(d: Pick<BookingDeposit, "status" | "amountCents"> | null | undefined): BookingDepositInfo | undefined {
  if (d?.status === "paid") return { amountCents: d.amountCents, status: "paid" };
  if (d?.status === "unpaid") return { amountCents: d.amountCents, status: "unpaid" };
  return undefined;
}
