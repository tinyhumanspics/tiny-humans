import "server-only";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { bookingRules } from "@/config/booking";
import { site } from "@/config/site";
import { createCancelToken, hashCancelToken, looksLikeCancelToken } from "@/lib/booking/cancel-token";
import { todayInZone } from "@/lib/booking/timezone";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { bookingLinks, type BookingLinkRow } from "@/lib/db/schema";
import { log } from "@/lib/log";
import type { BookingLinkInput, BookingLinkSummary } from "./types";

/**
 * Booking links (owner, Nov 19): /admin makes one with the session the family agreed with the owner; /book?link=…
 * fills itself in from it; the request it sends uses it once, and confirming that request reads the babies and the
 * source back. The token is random (only its SHA-256 hash is stored) and the Meta Pixel never loads on its URL.
 */

const missingTable = (err: unknown) => /booking_links/.test(String((err as { message?: unknown })?.message ?? "")) && /does not exist/.test(String((err as { message?: unknown })?.message ?? ""));

export const bookingLinkUrl = (token: string, locale: "en" | "es") => `${site.url.replace(/\/$/, "")}${locale === "es" ? "/es" : ""}/book?link=${token}`;

export async function createBookingLink(input: BookingLinkInput): Promise<{ url: string; row: BookingLinkRow }> {
  const { token, hash } = createCancelToken();
  const [row] = await getDb()
    .insert(bookingLinks)
    .values({
      tokenHash: hash,
      locale: input.locale,
      bundleId: input.bundleId,
      babies: input.babies.map((b) => ({ age: b.age, ...(b.name ? { name: b.name } : {}), ...(b.gender ? { gender: b.gender } : {}) })),
      zip: input.zip,
      slotDate: input.date,
      slotStart: input.start ?? null,
      source: input.source,
    })
    .returning();
  log.info("booking-links", "Link made", { bundle: row.bundleId, date: row.slotDate });
  return { url: bookingLinkUrl(token, input.locale), row };
}

/** The link behind a token while it can still be used: not used yet, and its day isn't past (Miami time). */
export async function openLinkByToken(token: unknown, now = new Date()): Promise<BookingLinkRow | null> {
  if (!looksLikeCancelToken(token) || !isDatabaseConfigured()) return null;
  try {
    const [row] = await getDb().select().from(bookingLinks).where(eq(bookingLinks.tokenHash, hashCancelToken(token))).limit(1);
    if (!row || row.requestId || row.usedAt || row.slotDate < todayInZone(bookingRules.timeZone, now)) return null;
    return row;
  } catch (err) {
    if (!missingTable(err)) log.error("booking-links", "Link lookup failed", { error: err as Error });
    return null;
  }
}

export const linkSummaryOf = (row: BookingLinkRow): BookingLinkSummary => ({
  bundleId: row.bundleId,
  babies: row.babies,
  zip: row.zip,
  date: row.slotDate,
  start: row.slotStart,
  locale: row.locale === "es" ? "es" : "en",
});

/** The request it sent: the link can't be used again. */
export async function markLinkUsed(id: string, requestId: string): Promise<void> {
  await getDb()
    .update(bookingLinks)
    .set({ requestId, usedAt: new Date() })
    .where(and(eq(bookingLinks.id, id), isNull(bookingLinks.requestId)));
}

/** The links behind these requests (/admin → Requests: "From your link"); empty when there's no database. */
export async function linksForRequests(requestIds: string[]): Promise<Map<string, BookingLinkRow>> {
  if (!requestIds.length || !isDatabaseConfigured()) return new Map();
  try {
    const rows = await getDb().select().from(bookingLinks).where(inArray(bookingLinks.requestId, requestIds));
    return new Map(rows.map((r) => [r.requestId!, r]));
  } catch (err) {
    if (!missingTable(err)) log.error("booking-links", "Links for requests not loaded", { error: err as Error });
    return new Map();
  }
}

export async function linkForRequest(requestId: string): Promise<BookingLinkRow | null> {
  return (await linksForRequests([requestId])).get(requestId) ?? null;
}
