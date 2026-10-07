import "server-only";
import { createHash } from "crypto";
import type { Bundle } from "@/config/bundles";
import { log } from "@/lib/log";

/**
 * "Last good" copy of the public bundle list, kept in Vercel Blob.
 *
 * If Neon can't be reached, the public site shows this copy (the prices the owner last published) instead of
 * hardcoded defaults. Each copy's file name carries a hash of its content, so a cheap `head()` tells whether the
 * current list is already stored: Blob is written only when prices/bundles actually change.
 */
const PREFIX = "pricing/public-catalog-";

let memory: { hash: string; bundles: Bundle[] } | null = null;

const storageOn = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const hashOf = (json: string) => createHash("sha256").update(json).digest("hex").slice(0, 16);

/** Remember a successfully loaded catalog (in memory, and in Blob when it changed). */
export async function rememberCatalog(bundles: Bundle[]): Promise<void> {
  if (!bundles.length) return;
  const json = JSON.stringify(bundles);
  const hash = hashOf(json);
  if (memory?.hash === hash) return;
  memory = { hash, bundles };
  if (!storageOn()) return;
  try {
    const { head, put, list, del } = await import("@vercel/blob");
    const pathname = `${PREFIX}${hash}.json`;
    if (await head(pathname).catch(() => null)) return;
    await put(pathname, json, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    log.info("pricing.snapshot", "Saved last-good catalog copy", { bundles: bundles.length });
    // keep the 5 newest copies
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const old = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).slice(5);
    if (old.length) await del(old.map((b) => b.url));
  } catch (err) {
    log.warn("pricing.snapshot", "Could not save last-good catalog copy", { error: err as Error });
  }
}

/** The last good catalog: this server's memory first, then the newest Blob copy. */
export async function lastGoodCatalog(): Promise<Bundle[] | null> {
  if (memory) return memory.bundles;
  if (!storageOn()) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX, limit: 100 });
    const newest = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    if (!newest) return null;
    // content-addressed file name: safe to cache
    const res = await fetch(newest.url, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) && data.length ? (data as Bundle[]) : null;
  } catch (err) {
    log.warn("pricing.snapshot", "No last-good catalog copy available", { error: err as Error });
    return null;
  }
}
