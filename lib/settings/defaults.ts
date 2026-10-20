import { emptyThemeMedia, mediaFromList, MEDIA_GROUPS, sectionsFromLegacy, type LegacyMedia, type MediaSection, type ThemeMedia } from "@/config/media";
import { SEASONAL_OFFER_IDS, type SeasonalOfferId } from "@/config/seasonal";
import { DEFAULT_THEME, THEME_IDS, type TinyHumansTheme } from "@/config/themes";
import type { PortfolioPhoto } from "@/config/portfolio";
import en from "@/messages/en.json";
import { isDateKey } from "@/lib/validation/date-key";
import type { SeasonalOfferSettings, SiteSettings } from "./types";

const DEFAULT_SEASONAL_OFFERS: Record<SeasonalOfferId, SeasonalOfferSettings> = {
  thanksgiving: { enabled: false, ...en.landing.seasonalOffers.defaults.thanksgiving, spanish: null },
  firstChristmas: { enabled: false, ...en.landing.seasonalOffers.defaults.firstChristmas, spanish: null },
};

const LEGACY_SEASONAL_TITLES: Partial<Record<SeasonalOfferId, readonly string[]>> = {
  thanksgiving: ["Baby's First Thanksgiving at Home"],
  firstChristmas: ["Baby's First Christmas at Home"],
};

export const defaultSettings: SiteSettings = {
  themeId: DEFAULT_THEME,
  spanishPublished: false,
  media: {},
  seasonalOffers: DEFAULT_SEASONAL_OFFERS,
  updatedAt: null,
};

const MAX_PHOTOS = 60;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Accept only photos stored in Vercel Blob or the built-in /portfolio files (data URLs only when a caller allows them). */
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

/** A problem with the settings the owner sent (its message is written for the owner). */
export class SettingsInputError extends Error {}

function parsePhotos(list: unknown[], allowDataUrls: boolean, setName: string): PortfolioPhoto[] {
  if (list.length > MAX_PHOTOS) throw new SettingsInputError(`Too many photos in ${setName} (max ${MAX_PHOTOS}).`);
  return list.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const src = typeof p.src === "string" ? p.src : "";
    if (!allowedSrc(src, allowDataUrls)) throw new SettingsInputError(`Photo ${i + 1} in ${setName} has an invalid image address.`);
    const width = Math.round(Number(p.width));
    const height = Math.round(Number(p.height));
    if (!(width > 0 && height > 0 && width < 20000 && height < 20000)) throw new SettingsInputError(`Photo ${i + 1} in ${setName} has invalid dimensions.`);
    const title = str(p.title, 80) || `Photo ${i + 1}`;
    const rawSpanish = p.spanish && typeof p.spanish === "object" ? (p.spanish as Record<string, unknown>) : null;
    const spanishTitle = rawSpanish ? str(rawSpanish.title, 60) : "";
    const spanishAlt = rawSpanish ? str(rawSpanish.alt, 160) : "";
    const spanishCaption = rawSpanish ? str(rawSpanish.caption, 40) : "";
    return {
      id: str(p.id, 64).replace(/[^a-z0-9-]/gi, "") || `photo-${i + 1}`,
      src,
      width,
      height,
      title,
      alt: str(p.alt, 200) || title,
      caption: str(p.caption, 60) || undefined,
      spanish: spanishTitle && spanishAlt ? { title: spanishTitle, alt: spanishAlt, caption: spanishCaption || undefined } : null,
    };
  });
}

const isThemeId = (v: unknown): v is TinyHumansTheme => (THEME_IDS as string[]).includes(v as string);
function parseSeasonalOffers(raw: unknown): Record<SeasonalOfferId, SeasonalOfferSettings> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    SEASONAL_OFFER_IDS.map((id) => {
      const fallback = DEFAULT_SEASONAL_OFFERS[id];
      const value = source[id] && typeof source[id] === "object" ? (source[id] as Record<string, unknown>) : null;
      const savedTitle = value ? str(value.title, 90) : "";
      const title = LEGACY_SEASONAL_TITLES[id]?.includes(savedTitle) ? fallback.title : savedTitle;
      const description = value ? str(value.description, 240) : "";
      const cutoff = value && isDateKey(value.cutoff) ? value.cutoff : "";
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

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const spanishWording = (v: unknown) => {
  const raw = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const title = raw ? text(raw.title, 60) : null;
  const body = raw ? text(raw.text, 120) : null;
  return title && body ? { title, text: body } : null;
};

/** "Little moments" as saved before sections existed (three groups of 3 + extra pictures). */
function parseLegacy(o: Record<string, unknown>, allowDataUrls: boolean, id: string): LegacyMedia {
  const gs = Array.isArray(o.groups) ? o.groups : [];
  const ex = Array.isArray(o.extra) ? o.extra.filter(Boolean) : [];
  return {
    groups: [0, 1, 2].map((gi) => {
      const g = (gs[gi] ?? {}) as Record<string, unknown>;
      const ps = Array.isArray(g.photos) ? g.photos : [];
      return {
        photos: [0, 1, 2].map((i) => parseSlot(ps[i], allowDataUrls, `${id} pictures`)),
        title: text(g.title, 60),
        text: text(g.text, 120),
        spanish: spanishWording(g.spanish),
      };
    }),
    extra: ex.length ? parsePhotos(ex.slice(0, 12), allowDataUrls, `${id} extra pictures`) : [],
  };
}

function parseSections(list: unknown[], allowDataUrls: boolean, id: string): MediaSection[] {
  const { maxSections, maxPhotos } = MEDIA_GROUPS.sections;
  if (list.length > maxSections) throw new SettingsInputError(`Too many sections in ${id} (max ${maxSections}).`);
  const sectionIds = new Set<string>();
  const photoIds = new Set<string>();
  return list.map((raw, si) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const ps = Array.isArray(s.photos) ? s.photos.filter(Boolean) : [];
    if (ps.length > maxPhotos) throw new SettingsInputError(`Too many pictures in section ${si + 1} (max ${maxPhotos}).`);
    // ids pick the box picture, the landing pictures and booking inspiration: keep them unique within the theme
    const photos = parsePhotos(ps, allowDataUrls, `${id} section ${si + 1}`).map((p, i) => {
      const unique = photoIds.has(p.id) ? `${p.id}-${si + 1}-${i + 1}` : p.id;
      photoIds.add(unique);
      return unique === p.id ? p : { ...p, id: unique };
    });
    let sectionId = str(s.id, 40).replace(/[^a-z0-9-]/gi, "") || `section-${si + 1}`;
    if (sectionIds.has(sectionId)) sectionId = `${sectionId}-${si + 1}`;
    sectionIds.add(sectionId);
    const title = text(s.title, 60) ?? "";
    const body = text(s.text, 120) ?? "";
    const promptPhotoId = typeof s.promptPhotoId === "string" && photos.some((p) => p.id === s.promptPhotoId) ? s.promptPhotoId : null;
    // a box without wording stays hidden (the owner area asks for it before switching the box on)
    return { id: sectionId, photos, prompt: s.prompt === true && Boolean(title && body), promptPhotoId, title, text: body, spanish: spanishWording(s.spanish) };
  });
}

function parseThemeMedia(raw: unknown, allowDataUrls: boolean, id: string, legacyBase?: LegacyMedia): ThemeMedia {
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
  if (Array.isArray(o.sections)) m.sections = parseSections(o.sections, allowDataUrls, id);
  else if (!("sections" in o)) m.sections = sectionsFromLegacy(parseLegacy(o, allowDataUrls, id), legacyBase);
  if (m.sections) {
    const ids = new Set(m.sections.flatMap((s) => s.photos.map((p) => p.id)));
    const picks = Array.isArray(o.landingPicks) ? o.landingPicks : [];
    m.landingPicks = [...new Set(picks.filter((p): p is string => typeof p === "string" && ids.has(p)))].slice(0, MEDIA_GROUPS.sections.landingPicks);
  }
  return m;
}

/** Validate untrusted settings (from the network or storage). Throws on bad input. */
export function parseSettings(input: unknown, { allowDataUrls = false } = {}): SiteSettings {
  const o = (input ?? {}) as Record<string, unknown>;
  const themeId = isThemeId(o.themeId) ? o.themeId : DEFAULT_THEME;
  const media: Partial<Record<TinyHumansTheme, ThemeMedia>> = {};
  const rawMedia = (o.media ?? {}) as Record<string, unknown>;
  const legacySets = (o.photoSets ?? {}) as Record<string, unknown>;
  // themes saved before sections existed took the Original theme's picture for every empty "Little moments" spot
  const legacyBase = rawMedia.default && !("sections" in (rawMedia.default as object)) ? parseLegacy(rawMedia.default as Record<string, unknown>, allowDataUrls, "default") : undefined;
  for (const id of THEME_IDS) {
    if (rawMedia[id]) media[id] = parseThemeMedia(rawMedia[id], allowDataUrls, id, id === "default" ? undefined : legacyBase);
    else if (Array.isArray(legacySets[id]) && (legacySets[id] as unknown[]).length) {
      // settings saved before media slots existed: same pictures, same positions
      media[id] = mediaFromList(parsePhotos(legacySets[id] as unknown[], allowDataUrls, `the ${id} pictures`));
    }
  }
  if (!media.default && Array.isArray(o.photos) && o.photos.length) media.default = mediaFromList(parsePhotos(o.photos, allowDataUrls, "the Original pictures"));
  return {
    themeId,
    spanishPublished: o.spanishPublished === true,
    media,
    seasonalOffers: parseSeasonalOffers(o.seasonalOffers),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

/** Every custom photo in every theme. */
export function allMediaPhotos(s: SiteSettings): PortfolioPhoto[] {
  return Object.values(s.media).flatMap((m) =>
    m ? [...m.title, ...m.landing, ...m.about, ...(m.email ?? []), ...(m.sections ?? []).flatMap((s) => s.photos)].filter(Boolean) as PortfolioPhoto[] : [],
  );
}

/** Every photo address used by any theme. */
export function allPhotoSources(s: SiteSettings): string[] {
  return allMediaPhotos(s).map((p) => p.src);
}

/**
 * The settings file as stored: each theme with its own sections also carries the pre-sections fields (first three
 * sections as the three groups, every other picture as extra pictures), so an older deployment (after a revert)
 * still shows the owner's pictures instead of built-in ones. parseSettings reads `sections` first.
 */
export function storedSettings(s: SiteSettings): unknown {
  const media = Object.fromEntries(
    Object.entries(s.media).map(([id, m]) => {
      if (!m?.sections) return [id, m];
      const groups = [0, 1, 2].map((gi) => {
        const section = m.sections![gi];
        return { photos: [0, 1, 2].map((i) => section?.photos[i] ?? null), title: section?.title || null, text: section?.text || null, spanish: section?.spanish ?? null };
      });
      const extra = m.sections.flatMap((section, si) => (si < 3 ? section.photos.slice(3) : section.photos)).slice(0, 12);
      return [id, { ...m, groups, extra }];
    }),
  );
  return { ...s, media };
}
