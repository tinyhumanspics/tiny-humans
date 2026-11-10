/** Pasted inspo links: clean them up and name the app they're from. */

export const MAX_LINK_LENGTH = 2000;

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$|^instagr\.am$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/, "Pinterest"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)vimeo\.com$/, "Vimeo"],
  [/(^|\.)facebook\.com$|^fb\.watch$/, "Facebook"],
];

/**
 * A pasted link as a safe http(s) address, or null. Adds https:// when someone pastes "instagram.com/p/…", drops
 * spaces around it, and refuses other schemes (javascript:, data:, …) and addresses with a user name or password.
 */
export function normalizeLink(input: string): string | null {
  let text = input.trim();
  if (!text || text.length > MAX_LINK_LENGTH || /\s/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(text)) return null;
    text = `https://${text}`;
  }
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "Instagram", "TikTok", "Pinterest", "YouTube", "Vimeo", "Facebook", else the site's name ("example.com"). */
export function platformOf(link: string): string | null {
  const url = normalizeLink(link);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, "");
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? host;
}

/** Google Maps search link (opens the Maps app on a phone), as in /admin → Leads. */
export const mapsHref = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
