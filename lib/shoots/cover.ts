import "server-only";
import { expandVideoLink } from "./expand-link";
import { coverSources } from "./players";

const MAX_BYTES = 1_500_000;
const HOPS = 3;
const TIMEOUT_MS = 6000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
// the apps' own addresses and their picture servers
const HOSTS = /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|ytimg\.com)$/;

export interface Cover {
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
}

const allowed = (url: URL) => url.protocol === "https:" && !url.username && !url.password && url.port === "" && HOSTS.test(url.hostname.toLowerCase());

/** Reads at most `max` bytes of a body; null when it's longer. */
async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** One picture address: follows up to 3 redirects on the apps' hosts; only a real JPEG/PNG/WebP/AVIF ≤ 1.5 MB counts. */
async function fetchPicture(source: string, fetcher: typeof fetch): Promise<Cover | null> {
  let current = new URL(source);
  for (let hop = 0; hop <= HOPS; hop += 1) {
    if (!allowed(current)) return null;
    let res: Response;
    try {
      res = await fetcher(current, { redirect: "manual", headers: { accept: "image/avif,image/webp,image/jpeg,image/*;q=0.8" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel().catch(() => undefined);
      const location = res.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.has(type) || Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    try {
      const bytes = await readCapped(res, MAX_BYTES);
      return bytes && bytes.byteLength > 0 ? { bytes, type } : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The cover picture of a pasted video (Instagram post/Reel, YouTube), fetched by the server because Instagram's
 * picture server refuses other websites. Null = no picture (TikTok, Vimeo, private/deleted, the app said no): the
 * card keeps its ▶. Only the post's own code goes out; nothing is stored.
 */
export async function coverFor(link: string, fetcher: typeof fetch = fetch): Promise<Cover | null> {
  const player = await expandVideoLink(link, fetcher);
  if (!player) return null;
  for (const source of coverSources(player)) {
    const cover = await fetchPicture(source, fetcher);
    if (cover) return cover;
  }
  return null;
}
