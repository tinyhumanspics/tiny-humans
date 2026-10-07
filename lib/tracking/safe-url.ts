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
