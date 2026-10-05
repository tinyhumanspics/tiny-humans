/**
 * SERVER ONLY. Reads and writes the owner's site settings in Vercel Blob.
 *
 * Settings are a small JSON file (settings/site-<timestamp>.json); uploaded
 * photos live under photos/. Public pages read settings through a tagged
 * cache, and saving calls revalidateTag so visitors get the change on their
 * next page load, without a redeploy.
 *
 * Without BLOB_READ_WRITE_TOKEN (local dev, prototype build) the built-in
 * defaults are used.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { allPhotoSources, defaultSettings, parseSettings } from "./defaults";
import type { SiteSettings } from "./types";

export const SETTINGS_TAG = "site-settings";
const PREFIX = "settings/site-";

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Uncached read of the newest settings file. */
export async function readSettingsFresh(): Promise<SiteSettings> {
  if (!isStorageConfigured()) return defaultSettings;
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: PREFIX, limit: 50 });
  if (!blobs.length) return defaultSettings;
  const latest = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
  const res = await fetch(latest.url, { cache: "no-store" });
  if (!res.ok) return defaultSettings;
  return parseSettings(await res.json());
}

const readCached = unstable_cache(
  async () => {
    try {
      return await readSettingsFresh();
    } catch {
      return defaultSettings;
    }
  },
  ["site-settings-v1"],
  { tags: [SETTINGS_TAG] },
);

/** Settings for public pages (cached until the owner saves a change). */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isStorageConfigured()) return defaultSettings;
  return readCached();
}

export async function saveSiteSettings(next: SiteSettings, previous: SiteSettings): Promise<SiteSettings> {
  const { put, list, del } = await import("@vercel/blob");
  const saved: SiteSettings = { ...next, updatedAt: new Date().toISOString() };
  await put(`${PREFIX}${Date.now()}.json`, JSON.stringify(saved), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  // keep the 5 newest settings files
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  const old = [...blobs].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).slice(5);
  if (old.length) await del(old.map((b) => b.url));

  // delete uploaded photos no picture set uses any more
  const keep = new Set(allPhotoSources(saved));
  const removed = [...new Set(allPhotoSources(previous))].filter((src) => src.includes(".blob.vercel-storage.com") && !keep.has(src));
  if (removed.length) await del(removed);

  revalidateTag(SETTINGS_TAG);
  return saved;
}
