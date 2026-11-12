import "server-only";
import { normalizeLink } from "./links";
import { hopAllowed, isShortVideoLink, playerOf, type Player } from "./players";

const HOPS = 5;
const TIMEOUT_MS = 5000;

/**
 * The player for a short share link (vm.tiktok.com/…, tiktok.com/t/…, instagram.com/share/…): follows its redirects
 * (only to TikTok/Instagram over https, at most 5, 5 s each, no body read) until one is a video address. Null when
 * it leads nowhere playable (deleted, private, the app's home page) or the app doesn't answer: the sheet then offers
 * "Open in TikTok" instead. Full links never leave the browser (playerOf).
 */
export async function expandVideoLink(link: string, fetcher: typeof fetch = fetch): Promise<Player | null> {
  const direct = playerOf(link);
  if (direct || !isShortVideoLink(link)) return direct;
  let current = new URL(normalizeLink(link)!);
  for (let hop = 0; hop < HOPS; hop += 1) {
    if (!hopAllowed(current)) return null;
    let res: Response;
    try {
      res = await fetcher(current, { method: "GET", redirect: "manual", headers: { accept: "text/html" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
      return null;
    }
    await res.body?.cancel().catch(() => undefined);
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return null;
    try {
      current = new URL(location, current);
    } catch {
      return null;
    }
    const player = playerOf(current.toString());
    if (player) return player;
  }
  return null;
}
