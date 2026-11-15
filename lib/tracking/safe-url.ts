/**
 * What page analytics (Vercel Web Analytics, Speed Insights) may see of a URL. Cancel/reschedule links carry a secret
 * token (`?t=`) and must never leave the site, so only an allowlist of harmless query parameters is kept.
 * The owner area is never measured. No personal or baby data ever appears in our URLs.
 */
const KEEP = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "bundle", "inspiration"]);

/** The URL with only allowlisted query parameters, or null when the page must not be measured. */
export function safeAnalyticsUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null;
  for (const key of [...url.searchParams.keys()]) if (!KEEP.has(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}

/**
 * Pages whose links carry a secret token (pay, cancel, reschedule, prepare, feedback, unsubscribe, review, waiver copy,
 * due-date return, and /book's deposit-return and due-date schedule links): the Meta Pixel is never loaded or called
 * there, so a token can't reach Meta in a page URL (brief 03).
 */
const TOKEN_PATHS = ["/pay", "/cancel", "/reschedule", "/backdrop", "/feedback", "/unsubscribe", "/review", "/waiver", "/due-date/done"];
const TOKEN_PARAMS = ["t", "k", "s", "token", "deposit", "due", "w", "r", "b"];

export function pixelAllowed(pathname: string, search = ""): boolean {
  const path = pathname === "/es" ? "/" : pathname.startsWith("/es/") ? pathname.slice(3) : pathname;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (TOKEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  const q = new URLSearchParams(search);
  return !TOKEN_PARAMS.some((k) => q.has(k));
}
