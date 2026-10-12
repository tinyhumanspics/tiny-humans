/** Where browsers send Content-Security-Policy reports (see app/api/csp-report). */
export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * The site's Content-Security-Policy.
 *
 * No nonces: Next.js would then have to render every page per request (no static/ISR caching), so inline scripts stay
 * allowed. What it does restrict: where scripts, images and connections may come from (this site, the Meta Pixel,
 * Vercel Blob photos), plugins, `<base>` and form targets, and who may frame the site.
 * Shipped as Report-Only first (Phase 6); enforce it once production reports stay quiet.
 */
export function contentSecurityPolicy({ dev = false, preview = false } = {}): string {
  // Vercel's preview-deployment toolbar (never on production).
  const vercelLive = preview ? ["https://vercel.live"] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // React needs eval only in development (error stacks); the Meta Pixel loader lives on connect.facebook.net.
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), "https://connect.facebook.net", ...vercelLive]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https://*.public.blob.vercel-storage.com", "https://www.facebook.com", ...vercelLive]],
    ["font-src", ["'self'", ...vercelLive]],
    ["connect-src", ["'self'", "https://www.facebook.com", "https://connect.facebook.net", ...vercelLive]],
    ["frame-src", ["'self'", ...vercelLive]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
    ["report-uri", [CSP_REPORT_PATH]],
    ["report-to", ["csp"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/** One violation, reduced to what's needed to fix the policy (no query strings: manage links carry tokens). */
export interface CspViolation {
  directive: string;
  blocked: string;
  page: string;
  source: string;
  disposition: string;
}

const EXTENSION = /^(chrome|moz|safari-web|ms-browser)-extension:/i;
const text = (value: unknown, max = 120) => (typeof value === "string" ? value.slice(0, max) : "");

/** A URL as origin + path only; CSP keywords (inline, eval, data, …) pass through. */
function stripUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? `${url.origin}${url.pathname}`.slice(0, 160) : url.protocol;
  } catch {
    return value.slice(0, 40);
  }
}

/**
 * Violations from either report format: the legacy `report-uri` body (`{"csp-report": {...}}`) or the Reporting API's
 * `application/reports+json` list (`[{type: "csp-violation", body: {...}}]`). Browser-extension noise is dropped.
 */
export function cspViolations(payload: unknown): CspViolation[] {
  const entries: Record<string, unknown>[] = [];
  if (Array.isArray(payload)) {
    for (const report of payload.slice(0, 10)) {
      const r = report as { type?: unknown; body?: unknown };
      if (r?.type === "csp-violation" && r.body && typeof r.body === "object") entries.push(r.body as Record<string, unknown>);
    }
  } else if (payload && typeof payload === "object" && (payload as Record<string, unknown>)["csp-report"]) {
    const legacy = (payload as Record<string, unknown>)["csp-report"];
    if (legacy && typeof legacy === "object") entries.push(legacy as Record<string, unknown>);
  }
  return entries.flatMap((e) => {
    const blockedRaw = text(e.blockedURL ?? e["blocked-uri"], 400);
    const sourceRaw = text(e.sourceFile ?? e["source-file"], 400);
    if (EXTENSION.test(blockedRaw) || EXTENSION.test(sourceRaw)) return [];
    const page = stripUrl(text(e.documentURL ?? e["document-uri"], 400));
    return [{
      directive: text(e.effectiveDirective ?? e["effective-directive"] ?? e["violated-directive"], 60),
      blocked: stripUrl(blockedRaw),
      page: page.startsWith("http") ? new URL(page).pathname : page,
      source: stripUrl(sourceRaw),
      disposition: text(e.disposition, 12),
    }];
  });
}
