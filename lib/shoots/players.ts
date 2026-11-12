import { normalizeLink } from "./links";

/**
 * Video links that play inside /admin → Shoots (owner, Nov 11: "play the video and stay in the shoot day sheet").
 * Pure (browser + server): a pasted Instagram, TikTok, YouTube or Vimeo link → the app's own embed player address.
 * Short share links (vm.tiktok.com/…, tiktok.com/t/…, instagram.com/share/…) are opened on the server first
 * (lib/shoots/expand-link.ts). Nothing loads from those apps until the owner taps a video.
 */

/** tall = phone video (TikTok, Shorts), wide = 16:9 (YouTube, Vimeo), post = Instagram's post card (white, scrolls). */
export type PlayerShape = "tall" | "wide" | "post";

export interface Player {
  src: string;
  shape: PlayerShape;
}

/** The app hosts a player may come from (also in the site's Content-Security-Policy frame-src). */
export const PLAYER_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.instagram.com", "https://www.tiktok.com", "https://player.vimeo.com"] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,40}$/;
const TIKTOK_ID = /^\d{8,25}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[a-f0-9]{6,24}$/i;

function parse(link: string): URL | null {
  const url = normalizeLink(link);
  return url ? new URL(url) : null;
}

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m)\./, "");
const pathOf = (url: URL) => url.pathname.split("/").filter(Boolean);

/** YouTube's start time: "90", "90s", "1m30s", "1h2m3s" → seconds (0 = from the start). */
export function startSeconds(value: string | null): number {
  if (!value) return 0;
  if (/^\d+s?$/.test(value)) return Number.parseInt(value, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function youtube(url: URL, host: string): Player | null {
  const parts = pathOf(url);
  let id: string | null | undefined;
  let shape: PlayerShape = "wide";
  if (host === "youtu.be") id = parts[0];
  else if (parts[0] === "watch") id = url.searchParams.get("v");
  else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed" || parts[0] === "v") {
    id = parts[1];
    if (parts[0] === "shorts") shape = "tall";
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const query = new URLSearchParams({ playsinline: "1", rel: "0" });
  const start = startSeconds(url.searchParams.get("t") ?? url.searchParams.get("start"));
  if (start > 0) query.set("start", String(start));
  return { src: `https://www.youtube-nocookie.com/embed/${id}?${query}`, shape };
}

function instagram(url: URL): Player | null {
  const parts = pathOf(url);
  // /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE, or the same after the account name (/maria/reel/CODE)
  const at = parts.findIndex((p) => p === "p" || p === "reel" || p === "reels" || p === "tv");
  if (at < 0 || at > 1) return null;
  const code = parts[at + 1];
  if (!code || !INSTAGRAM_CODE.test(code)) return null;
  const kind = parts[at] === "reel" || parts[at] === "reels" ? "reel" : "p";
  return { src: `https://www.instagram.com/${kind}/${code}/embed/`, shape: "post" };
}

function tiktok(url: URL): Player | null {
  const parts = pathOf(url);
  let id: string | undefined;
  if (parts[0]?.startsWith("@") && (parts[1] === "video" || parts[1] === "photo")) id = parts[2];
  else if (parts[0] === "v") id = parts[1]?.replace(/\.html$/, "");
  else if (parts[0] === "embed") id = parts[1] === "v2" ? parts[2] : parts[1];
  else if (parts[0] === "player" && parts[1] === "v1") id = parts[2];
  if (!id || !TIKTOK_ID.test(id)) return null;
  // rel=0: no "related videos" from strangers after it ends (developers.tiktok.com/doc/embed-player)
  return { src: `https://www.tiktok.com/player/v1/${id}?rel=0`, shape: "tall" };
}

function vimeo(url: URL, host: string): Player | null {
  const parts = pathOf(url);
  const rest = host === "player.vimeo.com" && parts[0] === "video" ? parts.slice(1) : parts;
  const id = rest[0];
  if (!id || !VIMEO_ID.test(id)) return null;
  // unlisted videos carry a hash: vimeo.com/ID/HASH or ?h=HASH
  const hash = rest[1] && VIMEO_HASH.test(rest[1]) ? rest[1] : url.searchParams.get("h");
  return { src: `https://player.vimeo.com/video/${id}${hash && VIMEO_HASH.test(hash) ? `?h=${hash}` : ""}`, shape: "wide" };
}

/** The player for a pasted link, or null (a photo pin, a profile, a story, another site: those keep opening the link). */
export function playerOf(link: string): Player | null {
  const url = parse(link);
  if (!url) return null;
  const host = hostOf(url);
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") return youtube(url, host);
  if (host === "instagram.com" || host === "instagr.am") return instagram(url);
  if (host === "tiktok.com") return tiktok(url);
  if (host === "vimeo.com" || host === "player.vimeo.com") return vimeo(url, host);
  return null;
}

/** A short share link whose video the server can find by following its redirect. */
export function isShortVideoLink(link: string): boolean {
  const url = parse(link);
  if (!url) return false;
  const host = hostOf(url);
  const first = pathOf(url)[0];
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return Boolean(first);
  if (host === "tiktok.com") return first === "t" && Boolean(pathOf(url)[1]);
  if (host === "instagram.com") return first === "share" && pathOf(url).length > 1;
  return false;
}

/** Plays inside the sheet (straight away, or once the server opened the short link). */
export const playsHere = (link: string | null | undefined): link is string => Boolean(link && (playerOf(link) || isShortVideoLink(link)));

/**
 * Where a player's cover picture comes from, best first (owner, Nov 12: "at least the reel picture so I know which one
 * it is"): Instagram's own /media/ address (a redirect to the post's picture; its CDN refuses other sites, so the
 * server fetches it: lib/shoots/cover.ts) and YouTube's thumbnails. TikTok and Vimeo don't give one out: none.
 */
export function coverSources(player: Player): string[] {
  const instagram = /^https:\/\/www\.instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)\/embed\/$/.exec(player.src);
  if (instagram) return [`https://www.instagram.com/p/${instagram[1]}/media/?size=m`];
  const youtube = /^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})\?/.exec(player.src);
  if (youtube) return [`https://i.ytimg.com/vi/${youtube[1]}/hq720.jpg`, `https://i.ytimg.com/vi/${youtube[1]}/mqdefault.jpg`];
  return [];
}

/** Worth asking for a cover picture: Instagram and YouTube links (also Instagram share links). */
export function hasCover(link: string): boolean {
  const player = playerOf(link);
  if (player) return coverSources(player).length > 0;
  const url = parse(link);
  return Boolean(url && hostOf(url) === "instagram.com" && isShortVideoLink(link));
}

/** Where opening a short link may lead: the same apps, https, no user name or odd port. */
export function hopAllowed(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    url.port === "" &&
    /(^|\.)(tiktok\.com|instagram\.com)$/.test(url.hostname.toLowerCase())
  );
}
