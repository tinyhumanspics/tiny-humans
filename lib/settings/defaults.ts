import { emptyThemeMedia, mediaFromList, MEDIA_GROUPS, type ThemeMedia } from "@/config/media";
import { SEASONAL_OFFER_IDS, type SeasonalOfferId } from "@/config/seasonal";
import { DEFAULT_THEME, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import type { PortfolioPhoto } from "@/config/portfolio";
import en from "@/messages/en.json";
import type { SeasonalOfferSettings, SiteSettings } from "./types";

const DEFAULT_SEASONAL_OFFERS: Record<SeasonalOfferId, SeasonalOfferSettings> = {
  thanksgiving: { enabled: false, ...en.landing.seasonalOffers.defaults.thanksgiving, spanish: null },
  christmasCards: { enabled: false, ...en.landing.seasonalOffers.defaults.christmasCards, spanish: null },
  firstChristmas: { enabled: false, ...en.landing.seasonalOffers.defaults.firstChristmas, spanish: null },
};

export const defaultSettings: SiteSettings = {
  themeId: DEFAULT_THEME,
  media: {},
  seasonalOffers: DEFAULT_SEASONAL_OFFERS,
  updatedAt: null,
};

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
const validDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function parseSeasonalOffers(raw: unknown): Record<SeasonalOfferId, SeasonalOfferSettings> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    SEASONAL_OFFER_IDS.map((id) => {
      const fallback = DEFAULT_SEASONAL_OFFERS[id];
      const value = source[id] && typeof source[id] === "object" ? (source[id] as Record<string, unknown>) : null;
      const title = value ? str(value.title, 90) : "";
      const description = value ? str(value.description, 240) : "";
      const cutoff = value && validDate(value.cutoff) ? value.cutoff : "";
      const rawSpanish = value?.spanish && typeof value.spanish === "object" ? (value.spanish as Record<string, unknown>) : null;
      const spanishTitle = rawSpanish ? str(rawSpanish.title, 90) : "";
      const spanishDescription = rawSpanish ? str(rawSpanish.description, 240) : "";
      // Old/corrupt settings stay hidden instead of silently publishing hard-coded business copy.
      const complete = Boolean(title && description && cutoff);
      return [id, {
        enabled: value?.enabled === true && complete,
        title: title || fallback.title,
        description: description || fallback.description,
        cutoff: cutoff || fallback.cutoff,
        spanish: spanishTitle && spanishDescription ? { title: spanishTitle, description: spanishDescription } : null,
      }];
    }),
  ) as Record<SeasonalOfferId, SeasonalOfferSettings>;
}

function parseSlot(v: unknown, allowDataUrls: boolean, where: string): PortfolioPhoto | null {
  if (!v) return null;
  return parsePhotos([v], allowDataUrls, where)[0] ?? null;
}

function parseThemeMedia(raw: unknown, allowDataUrls: boolean, id: string): ThemeMedia {
  const o = (raw ?? {}) as Record<string, unknown>;
  const m = emptyThemeMedia();
  const t = Array.isArray(o.title) ? o.title : [];
  m.title = [0, 1].map((i) => parseSlot(t[i], allowDataUrls, `${id} title pictures`));
  const landing = Array.isArray(o.landing) ? o.landing : [];
  m.landing = MEDIA_GROUPS.landing.slots.map((_, i) => parseSlot(landing[i], allowDataUrls, `${id} landing pictures`));
  const about = Array.isArray(o.about) ? o.about : [];
  m.about = MEDIA_GROUPS.about.slots.map((_, i) => parseSlot(about[i], allowDataUrls, `${id} about pictures`));
  const email = Array.isArray(o.email) ? o.email : [];
  m.email = MEDIA_GROUPS.email.slots.map((_, i) => parseSlot(email[i], allowDataUrls, `${id} email pictures`));
  const gs = Array.isArray(o.groups) ? o.groups : [];
  m.groups = m.groups.map((_, gi) => {
    const g = (gs[gi] ?? {}) as Record<string, unknown>;
    const ps = Array.isArray(g.photos) ? g.photos : [];
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    return { photos: [0, 1, 2].map((i) => parseSlot(ps[i], allowDataUrls, `${id} pictures`)), title: text(g.title, 60), text: text(g.text, 120) };
  });
  const ex = Array.isArray(o.extra) ? o.extra.filter(Boolean) : [];
  m.extra = ex.length ? parsePhotos(ex.slice(0, MEDIA_GROUPS.extra.max), allowDataUrls, `${id} extra pictures`) : [];
  return m;
}

/** Validate untrusted settings (from the network or storage). Throws on bad input. */
export function parseSettings(input: unknown, { allowDataUrls = false } = {}): SiteSettings {
  const o = (input ?? {}) as Record<string, unknown>;
  const themeId = isThemeId(o.themeId) ? o.themeId : DEFAULT_THEME;
  const media: Partial<Record<TinyHumansTheme, ThemeMedia>> = {};
  const rawMedia = (o.media ?? {}) as Record<string, unknown>;
  const legacySets = (o.photoSets ?? {}) as Record<string, unknown>;
  for (const id of THEME_IDS) {
    if (rawMedia[id]) media[id] = parseThemeMedia(rawMedia[id], allowDataUrls, id);
    else if (Array.isArray(legacySets[id]) && (legacySets[id] as unknown[]).length) {
      // settings saved before media slots existed: same pictures, same positions
      media[id] = mediaFromList(parsePhotos(legacySets[id] as unknown[], allowDataUrls, `the ${id} pictures`));
    }
  }
  if (!media.default && Array.isArray(o.photos) && o.photos.length) media.default = mediaFromList(parsePhotos(o.photos, allowDataUrls, "the Original pictures"));
  return {
    themeId,
    media,
    seasonalOffers: parseSeasonalOffers(o.seasonalOffers),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

/** Every custom photo in every theme. */
export function allMediaPhotos(s: SiteSettings): PortfolioPhoto[] {
  return Object.values(s.media).flatMap((m) =>
    m ? [...m.title, ...m.landing, ...m.about, ...(m.email ?? []), ...m.groups.flatMap((g) => g.photos), ...m.extra].filter(Boolean) as PortfolioPhoto[] : [],
  );
}

/** Every photo address used by any theme. */
export function allPhotoSources(s: SiteSettings): string[] {
  return allMediaPhotos(s).map((p) => p.src);
}
