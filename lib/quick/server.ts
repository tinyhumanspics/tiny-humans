import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { quickRequests, type QuickRequestRow } from "@/lib/db/schema";
import { isMissingTable } from "@/lib/deposit/server";
import { log } from "@/lib/log";
import { getCatalog } from "@/lib/pricing/server";
import type { QuickRequest } from "./types";
import type { QuickRequestInput } from "./validation";

/** The /admin list says this until migration 0034 runs (the form itself still works: the studio gets the email). */
export class QuickNotReadyError extends Error {
  constructor() {
    super("Run drizzle/0034_quick_requests.sql in Neon to keep the quick form's requests here (until then they only arrive by email).");
  }
}

const viewOf = (r: QuickRequestRow, bundleName: string | null): QuickRequest => ({
  id: r.id,
  parentName: r.parentName,
  email: r.email,
  phone: r.phone,
  zip: r.zip,
  babyName: r.babyName,
  babyAge: r.babyAge,
  dueDate: r.dueDate,
  bundleId: r.bundleId,
  bundleName,
  bestTime: r.bestTime,
  message: r.message,
  locale: r.locale === "es" ? "es" : "en",
  status: r.status === "booked" || r.status === "done" ? r.status : "new",
  bookingReference: r.bookingReference,
  createdAt: r.createdAt.toISOString(),
});

const bundleNames = async () => new Map((await getCatalog().catch(() => [])).map((b) => [b.id, b.name]));

/** Saves a request (best effort): null when there's no database or migration 0034 hasn't run (the email still goes). */
export async function saveQuickRequest(input: QuickRequestInput): Promise<QuickRequest | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb()
      .insert(quickRequests)
      .values({
        parentName: input.parentName,
        email: input.email,
        phone: input.phone,
        zip: input.zip,
        babyName: input.babyName ?? null,
        babyAge: input.babyAge ?? null,
        dueDate: input.babyAge === "Not born yet" ? (input.dueDate ?? null) : null,
        bundleId: input.bundleId ?? null,
        bestTime: input.bestTime ?? null,
        message: input.message ?? null,
        locale: input.locale,
      })
      .returning();
    return viewOf(row, (await bundleNames()).get(row.bundleId ?? "") ?? null);
  } catch (err) {
    if (!isMissingTable(err)) log.error("quick", "Quick request not saved", { error: err as Error });
    return null;
  }
}

/** /admin → Quotes / Booking: the newest requests first. */
export async function listQuickRequests(limit = 100): Promise<QuickRequest[]> {
  try {
    const [rows, names] = await Promise.all([getDb().select().from(quickRequests).orderBy(desc(quickRequests.createdAt)).limit(limit), bundleNames()]);
    return rows.map((r) => viewOf(r, names.get(r.bundleId ?? "") ?? null));
  } catch (err) {
    if (isMissingTable(err)) throw new QuickNotReadyError();
    throw err;
  }
}

/** "Booked" (with the booking's reference) or "Done"; "new" puts it back. */
export async function setQuickStatus(id: string, status: QuickRequest["status"], bookingReference?: string | null): Promise<void> {
  try {
    await getDb()
      .update(quickRequests)
      .set({ status, ...(bookingReference !== undefined ? { bookingReference } : {}), updatedAt: new Date() })
      .where(eq(quickRequests.id, id));
  } catch (err) {
    if (isMissingTable(err)) throw new QuickNotReadyError();
    throw err;
  }
}

export async function deleteQuickRequest(id: string): Promise<void> {
  try {
    await getDb().delete(quickRequests).where(eq(quickRequests.id, id));
  } catch (err) {
    if (isMissingTable(err)) throw new QuickNotReadyError();
    throw err;
  }
}
