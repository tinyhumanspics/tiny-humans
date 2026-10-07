/**
 * Booking source ("where did this family come from?"): the first touch of a visit, stored in a first-party,
 * httpOnly cookie for 90 days by `proxy.ts` and saved on the booking by the booking-create route.
 *
 * Used by proxy.ts (Node.js runtime in Next 16); keep it free of heavy imports.
 * Privacy: only campaign parameters, the landing path and the referring site's origin are kept (never a full
 * referrer URL, which can contain personal data).
 */
export const SOURCE_COOKIE = "th_src";
/** Latest Meta click id, in Meta's `_fbc` format, for the Conversions API when the Pixel's own `_fbc` is missing. */
export const FBC_COOKIE = "th_fbc";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 90;

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  landingPath?: string;
  /** Origin of an external referring site, e.g. "https://l.instagram.com". */
  referrer?: string;
  /** When this touch happened (ISO). */
  at: string;
}

const FIELDS = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "fbclid", "landingPath", "referrer"] as const;
const clip = (v: string | null | undefined, max = 200) => (v ? v.trim().slice(0, max) || undefined : undefined);

/** The touch described by a page request. */
export function attributionFromRequest(url: URL, referer: string | null, now = new Date()): Attribution {
  const p = url.searchParams;
  let referrer: string | undefined;
  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host !== url.host) referrer = r.origin;
    } catch {
      /* ignore malformed */
    }
  }
  return {
    utmSource: clip(p.get("utm_source")),
    utmMedium: clip(p.get("utm_medium")),
    utmCampaign: clip(p.get("utm_campaign")),
    utmContent: clip(p.get("utm_content")),
    utmTerm: clip(p.get("utm_term")),
    fbclid: clip(p.get("fbclid"), 500),
    landingPath: clip(url.pathname, 300),
    referrer: clip(referrer, 200),
    at: now.toISOString(),
  };
}

/** A touch that carries real source information (campaign tags, a Meta click id, or an external referrer). */
export function isCampaign(a: Attribution | null | undefined): boolean {
  return Boolean(a && (a.utmSource || a.utmCampaign || a.fbclid || a.referrer));
}

export function encodeAttribution(a: Attribution): string {
  const out: Record<string, string> = { at: a.at };
  for (const k of FIELDS) if (a[k]) out[k] = a[k] as string;
  return encodeURIComponent(JSON.stringify(out));
}

export function decodeAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    const at = typeof data.at === "string" && !Number.isNaN(Date.parse(data.at)) ? data.at : new Date().toISOString();
    const out: Attribution = { at };
    for (const k of FIELDS) if (typeof data[k] === "string") out[k] = clip(data[k] as string, k === "fbclid" ? 500 : 300);
    return out;
  } catch {
    return null;
  }
}

/** Short human label for /admin (e.g. "Meta ads", "Instagram", "Google", "Direct"). */
export function sourceLabel(a: Pick<Attribution, "utmSource" | "utmMedium" | "fbclid" | "referrer"> | null | undefined): string {
  if (!a) return "Unknown";
  const s = (a.utmSource ?? "").toLowerCase();
  const m = (a.utmMedium ?? "").toLowerCase();
  const ref = (a.referrer ?? "").toLowerCase();
  const meta = /^(facebook|fb|instagram|ig|meta)$/.test(s);
  if (meta && /(paid|cpc|ppc|ads?)/.test(m)) return "Meta ads";
  if (a.fbclid && (meta || !s)) return "Meta ads";
  if (meta) return s.startsWith("i") ? "Instagram" : "Facebook";
  if (s) return a.utmSource!;
  if (/instagram\./.test(ref)) return "Instagram";
  if (/facebook\.|fb\.com|fb\.me/.test(ref)) return "Facebook";
  if (/google\./.test(ref)) return "Google";
  if (ref) return ref.replace(/^https?:\/\/(www\.)?/, "");
  return "Direct";
}
