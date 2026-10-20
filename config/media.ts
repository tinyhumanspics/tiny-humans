import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { AppLocale } from "@/i18n/config";
import { portfolio, portfolioCtas, type FeedBlock, type PortfolioPhoto } from "./portfolio";

/**
 * Editable image groups, named after WHERE they appear on the public site.
 * Every theme (Default, Thanksgiving, Christmas, New Year) shares this page
 * layout, so every theme has the same groups, each stored independently.
 */
export const MEDIA_GROUPS = {
  title: {
    label: "Title Pictures",
    where: "The two pinned photos next to the main title (“Tiny moments. Big memories.”) at the top of the home page.",
    slots: 2,
  },
  landing: {
    label: "Stay-Home Session Page (/home-sweet-home)",
    where: `The two photos on the ad landing page: “${en.landing.how.photo}” under “${en.landing.how.title}”, and “${en.landing.meet.photo}” next to “${en.landing.meet.title}”. Until you add one, the page uses the matching About Us photo (“Behind the scenes”, “Adrian & Alondra”), or a “photo coming soon” card if that one is empty too.`,
    // same names as the "photo coming soon" cards on the page
    slots: [en.landing.how.photo, en.landing.meet.photo],
  },
  about: {
    label: "About Us Page",
    where: "The four photos on the /about page. Until you add one, visitors see the matching “photo coming soon” card.",
    slots: ["Adrian & Alondra", "Behind the scenes", "Adrian at work", "Alondra styling a set"],
  },
  email: {
    label: "Emails",
    where: "The round photo in “Meet your photographers” in the booking confirmation email. It's shown as a small circle, so a close-up of your faces works best. Until you add one, the email uses the “Adrian & Alondra” photo from the About Us Page.",
    slots: ["Meet your photographers"],
  },
  sections: {
    label: "Little Moments Sections",
    where: `The “${en.home.portfolio.title}” part of the home page, top to bottom. Each section shows its pictures in rows of 3, then (when switched on) the “${en.home.portfolio.ctaLabel}” box with one of its pictures.`,
    maxSections: 10,
    maxPhotos: 12,
    /** Pictures that can be picked for the ad landing page's gallery. */
    landingPicks: 6,
  },
};

/** One section of the home page's "Little moments": its pictures, then (optionally) the "Book a memory like this one" box. */
export interface MediaSection {
  /** Stable id (never shown). */
  id: string;
  photos: PortfolioPhoto[];
  /** Show the box after the pictures (needs its wording). */
  prompt: boolean;
  /** The picture shown in the box and picked when a parent books from it; null = the middle one. */
  promptPhotoId: string | null;
  /** The box's wording (kept while the box is switched off). */
  title: string;
  text: string;
  /** Matched wording for Spanish pages. */
  spanish: { title: string; text: string } | null;
}

/** One theme's pictures. */
export interface ThemeMedia {
  title: (PortfolioPhoto | null)[];
  landing: (PortfolioPhoto | null)[];
  about: (PortfolioPhoto | null)[];
  /** Photos used in emails (not on the website). */
  email: (PortfolioPhoto | null)[];
  /** "Little moments" sections; null = the Original theme's (built-in ones for the Original theme itself). */
  sections: MediaSection[] | null;
  /** Ids of the section pictures picked for the ad landing page (max 6); empty = the first 6. */
  landingPicks: string[];
}

/** "Little moments" as saved before sections existed: three groups of 3 pictures, each with its box, then extra pictures. */
export interface LegacyMedia {
  groups: { photos: (PortfolioPhoto | null)[]; title?: string | null; text?: string | null; spanish?: { title: string; text: string } | null }[];
  extra: PortfolioPhoto[];
}

/**
 * An empty landing slot shows the About Us photo of the same subject (same frame shape): “Our set-up in a family's
 * living room” (3:2) ← “Behind the scenes” (3:2), “Adrian & Alondra” (4:5) ← “Adrian & Alondra” (4:5).
 */
export const LANDING_FROM_ABOUT = [1, 0] as const;

/** The built-in pictures for every slot (same look as before slots existed). */
export const BUILT_IN = {
  title: [portfolio[0], portfolio[Math.min(4, portfolio.length - 1)]],
  /** The three "Little moments" sections before anything is changed in /admin. */
  sections: portfolioCtas.map((cta, gi): MediaSection => ({
    id: `section-${gi + 1}`,
    photos: portfolio.slice(gi * 3, gi * 3 + 3),
    prompt: true,
    promptPhotoId: null,
    title: cta.title,
    text: cta.text,
    spanish: es.home.portfolio.prompts[gi],
  })),
};

export function emptyThemeMedia(): ThemeMedia {
  return {
    title: [null, null],
    landing: MEDIA_GROUPS.landing.slots.map(() => null),
    about: MEDIA_GROUPS.about.slots.map(() => null),
    email: MEDIA_GROUPS.email.slots.map(() => null),
    sections: null,
    landingPicks: [],
  };
}

/**
 * Old "Little moments" settings -> sections with the same pictures, wording and order. An empty spot showed the
 * Original theme's picture (`base`), else the built-in one; extra pictures become a last section without a box.
 * null = nothing was changed, so the theme keeps following the Original theme (or the built-in sections).
 */
export function sectionsFromLegacy(own: LegacyMedia, base?: LegacyMedia): MediaSection[] | null {
  const changed = own.extra.length > 0 || own.groups.some((g) => g.photos.some(Boolean) || g.title || g.text || g.spanish);
  if (!changed) return null;
  const sections = BUILT_IN.sections.map((builtIn, gi): MediaSection => {
    const g = own.groups[gi];
    const b = base?.groups[gi];
    return {
      ...builtIn,
      photos: [0, 1, 2].map((i) => g?.photos[i] ?? b?.photos[i] ?? builtIn.photos[i]).filter(Boolean) as PortfolioPhoto[],
      title: g?.title?.trim() || b?.title?.trim() || builtIn.title,
      text: g?.text?.trim() || b?.text?.trim() || builtIn.text,
      spanish: g?.spanish ?? b?.spanish ?? builtIn.spanish,
    };
  });
  const extra = own.extra.length ? own.extra : (base?.extra ?? []);
  if (extra.length) sections.push({ id: "section-more", photos: extra, prompt: false, promptPhotoId: null, title: "", text: "", spanish: null });
  return sections;
}

/** Old single-list picture sets -> slots, keeping the same visual positions. */
export function mediaFromList(list: PortfolioPhoto[]): ThemeMedia {
  const m = emptyThemeMedia();
  if (!list.length) return m;
  m.title = [list[0] ?? null, list[Math.min(4, list.length - 1)] ?? null];
  m.sections = sectionsFromLegacy({ groups: [0, 1, 2].map((gi) => ({ photos: [0, 1, 2].map((i) => list[gi * 3 + i] ?? null) })), extra: list.slice(9) });
  return m;
}

/**
 * What the site shows for a theme: the theme's own picture for a slot, else the Default theme's picture for that slot
 * (`fallback`, for every other theme), else the built-in picture / "photo coming soon". "Little moments" sections go
 * as a whole: the theme's own sections, else the Default theme's, so a theme nobody customized looks like Default in
 * its own colors.
 */
export interface ResolvedSection {
  photos: PortfolioPhoto[];
  /** The "Book a memory like this one" box after the pictures; null = switched off. */
  prompt: { photo: PortfolioPhoto; title: string; text: string } | null;
}

export interface ResolvedMedia {
  title: PortfolioPhoto[];
  landing: (PortfolioPhoto | null)[];
  about: (PortfolioPhoto | null)[];
  sections: ResolvedSection[];
  /** The ad landing page's gallery: the pictures picked in /admin, else the first 6 (skipping the two title photos). */
  gallery: PortfolioPhoto[];
}

function localizedPhoto(photo: PortfolioPhoto | null | undefined, locale: AppLocale): PortfolioPhoto | null {
  if (!photo) return null;
  if (locale === "en") return photo;
  return photo.spanish ? { ...photo, ...photo.spanish } : null;
}

/** A theme's "Little moments" sections and landing picks: its own, else the Default theme's, else the built-in ones. */
export function sectionsFor(m: ThemeMedia | undefined, fallback?: ThemeMedia): { sections: MediaSection[]; landingPicks: string[] } {
  if (m?.sections) return { sections: m.sections, landingPicks: m.landingPicks };
  if (fallback?.sections) return { sections: fallback.sections, landingPicks: fallback.landingPicks };
  return { sections: BUILT_IN.sections, landingPicks: [] };
}

export function resolveMedia(m: ThemeMedia | undefined, fallback?: ThemeMedia, locale: AppLocale = "en"): ResolvedMedia {
  const media = m ?? emptyThemeMedia();
  const f = fallback;
  const about = MEDIA_GROUPS.about.slots.map((_, i) => media.about?.[i] ?? f?.about?.[i] ?? null);
  const title = MEDIA_GROUPS.title.slots ? [0, 1].map((i) => localizedPhoto(media.title[i] ?? f?.title[i] ?? BUILT_IN.title[i], locale)).filter(Boolean) as PortfolioPhoto[] : [];
  const { sections, landingPicks } = sectionsFor(media, f);
  const resolved = sections.map((s): ResolvedSection => {
    const photos = s.photos.map((photo) => localizedPhoto(photo, locale)).filter(Boolean) as PortfolioPhoto[];
    const wording = locale === "es" ? s.spanish : { title: s.title, text: s.text };
    const photo = photos.find((p) => p.id === s.promptPhotoId) ?? photos[Math.min(1, photos.length - 1)];
    return { photos, prompt: s.prompt && photo && wording?.title && wording.text ? { photo, title: wording.title, text: wording.text } : null };
  });
  const all = resolved.flatMap((s) => s.photos);
  const picked = all.filter((p) => landingPicks.includes(p.id));
  const titleIds = new Set(title.map((p) => p.id));
  return {
    title,
    landing: MEDIA_GROUPS.landing.slots.map((_, i) => localizedPhoto(media.landing?.[i] ?? f?.landing?.[i] ?? about[LANDING_FROM_ABOUT[i]] ?? null, locale)),
    about: about.map((photo) => localizedPhoto(photo, locale)),
    sections: resolved,
    gallery: (picked.length ? picked : all.filter((p) => !titleIds.has(p.id))).slice(0, MEDIA_GROUPS.sections.landingPicks),
  };
}

/** The Default theme's pictures, used for empty slots of every other theme. */
export const fallbackMediaFor = (themeId: string, all: Partial<Record<string, ThemeMedia>>): ThemeMedia | undefined => (themeId === "default" ? undefined : all.default);

/**
 * The "Meet your photographers" photo in the confirmation email for a theme: its own Emails photo, else the Original
 * theme's, else the "Adrian & Alondra" About Us photo (theme's own, then Original's). null = the email shows no photo.
 */
export function photographersEmailPhoto(all: Partial<Record<string, ThemeMedia>>, themeId: string): PortfolioPhoto | null {
  const own = all[themeId];
  const base = themeId === "default" ? undefined : all.default;
  return own?.email?.[0] ?? base?.email?.[0] ?? own?.about?.[0] ?? base?.about?.[0] ?? null;
}

/** Photos in feed order (for the lightbox and inspiration links). */
export const feedPhotos = (r: ResolvedMedia) => r.sections.flatMap((s) => s.photos);

/** Home page "Little moments" feed: each section's pictures in rows of 3, then its box (when switched on). */
export function buildFeedFromMedia(r: ResolvedMedia): FeedBlock[] {
  const feed: FeedBlock[] = [];
  for (const s of r.sections) {
    for (let i = 0; i < s.photos.length; i += 3) feed.push({ type: "photos", photos: s.photos.slice(i, i + 3) });
    if (s.prompt) feed.push({ type: "cta", ...s.prompt });
  }
  return feed;
}
