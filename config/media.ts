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
    label: "Stay-Home Session Page",
    where: "The two photos on the /home-sweet-home page. Until you add one, visitors see the matching “photo coming soon” card.",
    slots: ["Behind the scenes", "Meet the photographers"],
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
  feed: portfolioCtas.map((cta) => ({
    label: `${cta.title.replace(/[?.!]/g, "").replace(/\b\w/g, (c) => c.toUpperCase())} Pictures`,
    where: `The 3 photos in the “Little moments” section just above the “${cta.title}” prompt. The middle one is also shown inside that prompt.`,
    slots: 3,
    defaultTitle: cta.title,
    defaultText: cta.text,
  })),
  extra: {
    label: "More Little Moments Pictures",
    where: "Extra photos at the end of the “Little moments” section, after the last prompt (optional).",
    max: 12,
  },
};

export interface MediaGroup {
  /** One per slot; null = the built-in picture for that position. */
  photos: (PortfolioPhoto | null)[];
  /** Prompt under this group (null/empty = default wording). */
  title?: string | null;
  text?: string | null;
}

/** One theme's pictures. */
export interface ThemeMedia {
  title: (PortfolioPhoto | null)[];
  landing: (PortfolioPhoto | null)[];
  about: (PortfolioPhoto | null)[];
  /** Photos used in emails (not on the website). */
  email: (PortfolioPhoto | null)[];
  groups: MediaGroup[];
  extra: PortfolioPhoto[];
}

/** The built-in pictures for every slot (same look as before slots existed). */
export const BUILT_IN = {
  title: [portfolio[0], portfolio[Math.min(4, portfolio.length - 1)]],
  groups: MEDIA_GROUPS.feed.map((_, g) => portfolio.slice(g * 3, g * 3 + 3)),
};

export function emptyThemeMedia(): ThemeMedia {
  return {
    title: [null, null],
    landing: MEDIA_GROUPS.landing.slots.map(() => null),
    about: MEDIA_GROUPS.about.slots.map(() => null),
    email: MEDIA_GROUPS.email.slots.map(() => null),
    groups: MEDIA_GROUPS.feed.map(() => ({ photos: [null, null, null], title: null, text: null })),
    extra: [],
  };
}

/** Old single-list picture sets -> slots, keeping the same visual positions. */
export function mediaFromList(list: PortfolioPhoto[]): ThemeMedia {
  const m = emptyThemeMedia();
  if (!list.length) return m;
  m.title = [list[0] ?? null, list[Math.min(4, list.length - 1)] ?? null];
  m.groups.forEach((g, gi) => (g.photos = [0, 1, 2].map((i) => list[gi * 3 + i] ?? null)));
  m.extra = list.slice(9);
  return m;
}

/**
 * What the site shows for a theme: the theme's own picture for a slot, else the Default theme's picture for that slot
 * (`fallback`, for every other theme), else the built-in picture / "photo coming soon". The same goes for the
 * "Little moments" prompts and the extra pictures, so a theme nobody customized looks like Default in its own colors.
 */
export interface ResolvedMedia {
  title: PortfolioPhoto[];
  landing: (PortfolioPhoto | null)[];
  about: (PortfolioPhoto | null)[];
  groups: { photos: PortfolioPhoto[]; title: string; text: string }[];
  extra: PortfolioPhoto[];
}

export function resolveMedia(m: ThemeMedia | undefined, fallback?: ThemeMedia): ResolvedMedia {
  const media = m ?? emptyThemeMedia();
  const f = fallback;
  return {
    title: MEDIA_GROUPS.title.slots ? [0, 1].map((i) => media.title[i] ?? f?.title[i] ?? BUILT_IN.title[i]) : [],
    landing: MEDIA_GROUPS.landing.slots.map((_, i) => media.landing?.[i] ?? f?.landing?.[i] ?? null),
    about: MEDIA_GROUPS.about.slots.map((_, i) => media.about?.[i] ?? f?.about?.[i] ?? null),
    groups: MEDIA_GROUPS.feed.map((def, gi) => {
      const g = media.groups[gi];
      const fg = f?.groups[gi];
      return {
        photos: [0, 1, 2].map((i) => g?.photos[i] ?? fg?.photos[i] ?? BUILT_IN.groups[gi][i]).filter(Boolean) as PortfolioPhoto[],
        title: g?.title?.trim() || fg?.title?.trim() || def.defaultTitle,
        text: g?.text?.trim() || fg?.text?.trim() || def.defaultText,
      };
    }),
    extra: media.extra.length ? media.extra : (f?.extra ?? []),
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
export const feedPhotos = (r: ResolvedMedia) => [...r.groups.flatMap((g) => g.photos), ...r.extra];

/** Home page "Little moments" feed: each group, then its prompt; extra photos last. */
export function buildFeedFromMedia(r: ResolvedMedia): FeedBlock[] {
  const feed: FeedBlock[] = [];
  r.groups.forEach((g) => {
    if (!g.photos.length) return;
    feed.push({ type: "photos", photos: g.photos });
    feed.push({ type: "cta", photo: g.photos[Math.min(1, g.photos.length - 1)], title: g.title, text: g.text });
  });
  for (let i = 0; i < r.extra.length; i += 3) feed.push({ type: "photos", photos: r.extra.slice(i, i + 3) });
  return feed;
}
