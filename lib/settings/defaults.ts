import { DEFAULT_THEME, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import type { PortfolioPhoto } from "@/config/portfolio";
import type { PhotoSetId, SiteSettings } from "./types";

export const defaultSettings: SiteSettings = { themeId: DEFAULT_THEME, photoSetId: DEFAULT_THEME, photoSets: {}, updatedAt: null };

const MAX_PHOTOS = 60;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Accept only photos stored in Vercel Blob, the built-in /portfolio files, or (prototype) data URLs. */
function allowedSrc(src: string, allowDataUrls: boolean): boolean {
  if (src.startsWith("/portfolio/")) return true;
  if (allowDataUrls && src.startsWith("data:image/")) return true;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function parsePhotos(list: unknown[], allowDataUrls: boolean, setName: string): PortfolioPhoto[] {
  if (list.length > MAX_PHOTOS) throw new Error(`Too many photos in ${setName} (max ${MAX_PHOTOS}).`);
  return list.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const src = typeof p.src === "string" ? p.src : "";
    if (!allowedSrc(src, allowDataUrls)) throw new Error(`Photo ${i + 1} in ${setName} has an invalid image address.`);
    const width = Math.round(Number(p.width));
    const height = Math.round(Number(p.height));
    if (!(width > 0 && height > 0 && width < 20000 && height < 20000)) throw new Error(`Photo ${i + 1} in ${setName} has invalid dimensions.`);
    const title = str(p.title, 80) || `Photo ${i + 1}`;
    return {
      id: str(p.id, 64).replace(/[^a-z0-9-]/gi, "") || `photo-${i + 1}`,
      src,
      width,
      height,
      title,
      alt: str(p.alt, 200) || title,
      caption: str(p.caption, 60) || undefined,
    };
  });
}

const isThemeId = (v: unknown): v is TinyHumansTheme => (THEME_IDS as string[]).includes(v as string);

/** Validate untrusted settings (from the network or storage). Throws on bad input. */
export function parseSettings(input: unknown, { allowDataUrls = false } = {}): SiteSettings {
  const o = (input ?? {}) as Record<string, unknown>;
  const themeId = isThemeId(o.themeId) ? o.themeId : DEFAULT_THEME;
  const photoSets: Partial<Record<PhotoSetId, PortfolioPhoto[]>> = {};
  const rawSets = (o.photoSets ?? {}) as Record<string, unknown>;
  for (const id of THEME_IDS) {
    const list = rawSets[id];
    if (Array.isArray(list) && list.length) photoSets[id] = parsePhotos(list, allowDataUrls, id === "default" ? "the Original pictures" : `the ${id} pictures`);
  }
  // settings saved before picture sets existed
  if (!photoSets.default && Array.isArray(o.photos) && o.photos.length) photoSets.default = parsePhotos(o.photos, allowDataUrls, "the Original pictures");
  const photoSetId = isThemeId(o.photoSetId) && (o.photoSetId === "default" || photoSets[o.photoSetId]) ? o.photoSetId : DEFAULT_THEME;
  return { themeId, photoSetId, photoSets, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null };
}

/** Every photo address used by any picture set. */
export function allPhotoSources(s: SiteSettings): string[] {
  return Object.values(s.photoSets).flatMap((list) => (list ?? []).map((p) => p.src));
}
