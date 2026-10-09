import "server-only";
import { createHash } from "crypto";
import type { Bundle } from "@/config/bundles";
import { defaultLocale, type AppLocale } from "@/i18n/config";
import { log } from "@/lib/log";

/**
 * "Last good" copy of the public bundle list, kept in Vercel Blob.
 *
 * If Neon can't be reached, the public site shows this copy (the prices the owner last published) instead of
 * hardcoded defaults. Each copy's file name carries a hash of its content, so a cheap `head()` tells whether the
 * current list is already stored: Blob is written only when prices/bundles actually change.
 */
const PREFIX = "pricing/public-catalog-";
const SPANISH_PREFIX = "pricing/spanish-public-catalog-";

const memory: Partial<Record<AppLocale, { hash: string; bundles: Bundle[] }>> = {};

const storageOn = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const hashOf = (json: string) => createHash("sha256").update(json).digest("hex").slice(0, 16);
const prefixFor = (locale: AppLocale) => (locale === defaultLocale ? PREFIX : SPANISH_PREFIX);

/** Remember a successfully loaded catalog (in memory, and in Blob when it changed). */
export async function rememberCatalog(bundles: Bundle[], locale: AppLocale = defaultLocale): Promise<void> {
  if (!bundles.length) return;
  const json = JSON.stringify(bundles);
  const hash = hashOf(json);
  if (memory[locale]?.hash === hash) return;
  memory[locale] = { hash, bundles };
  if (!storageOn()) return;
  try {
    const { head, put, list, del } = await import("@vercel/blob");
    const prefix = prefixFor(locale);
    const pathname = `${prefix}${hash}.json`;
    if (await head(pathname).catch(() => null)) return;
    await put(pathname, json, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    log.info("pricing.snapshot", "Saved last-good catalog copy", { bundles: bundles.length, locale });
    // keep the 5 newest copies
    const { blobs } = await list({ prefix, limit: 100 });
    const old = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).slice(5);
    if (old.length) await del(old.map((b) => b.url));
  } catch (err) {
    log.warn("pricing.snapshot", "Could not save last-good catalog copy", { error: err as Error });
  }
}

/** The last good catalog: this server's memory first, then the newest Blob copy. */
export async function lastGoodCatalog(locale: AppLocale = defaultLocale): Promise<Bundle[] | null> {
  if (memory[locale]) return memory[locale]?.bundles ?? null;
  if (!storageOn()) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: prefixFor(locale), limit: 100 });
    const newest = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    if (!newest) return null;
    // content-addressed file name: safe to cache
    const res = await fetch(newest.url, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !data.length) return null;
    const bundles = data as Bundle[];
    memory[locale] = { hash: hashOf(JSON.stringify(bundles)), bundles };
    return bundles;
  } catch (err) {
    log.warn("pricing.snapshot", "No last-good catalog copy available", { error: err as Error });
    return null;
  }
}
