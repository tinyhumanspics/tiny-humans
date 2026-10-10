import { NextResponse, type NextRequest } from "next/server";
import { ATTRIBUTION_MAX_AGE, FBC_COOKIE, SOURCE_COOKIE, attributionFromRequest, decodeAttribution, encodeAttribution, isCampaign } from "@/lib/tracking/attribution";
import { PUBLIC_LOCALE_HEADER } from "@/i18n/config";

/**
 * Booking source capture (first touch). On a page visit, store where the family came from in a first-party,
 * httpOnly cookie set by the server (Safari keeps server-set cookies; script-set ones can expire after a day when
 * the link has a click id). The first touch is kept for 90 days; a plain "direct" first touch is replaced by a later
 * campaign touch. The latest Meta click id is also kept (for the Conversions API).
 */
export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const spanish = req.nextUrl.pathname === "/es" || req.nextUrl.pathname.startsWith("/es/");
  requestHeaders.set(PUBLIC_LOCALE_HEADER, spanish ? "es" : "en");
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  const isDocument =
    req.headers.get("sec-fetch-dest") === "document" ||
    (!req.headers.get("rsc") && !req.headers.get("next-router-prefetch") && (req.headers.get("accept") ?? "").includes("text/html"));
  if (req.method !== "GET" || !isDocument) return res;

  const cookie = { maxAge: ATTRIBUTION_MAX_AGE, httpOnly: true, sameSite: "lax" as const, secure: req.nextUrl.protocol === "https:", path: "/" };
  const touch = attributionFromRequest(req.nextUrl, req.headers.get("referer"));
  const existing = decodeAttribution(req.cookies.get(SOURCE_COOKIE)?.value);
  if (!existing || (!isCampaign(existing) && isCampaign(touch))) res.cookies.set(SOURCE_COOKIE, encodeAttribution(touch), cookie);
  if (touch.fbclid) res.cookies.set(FBC_COOKIE, `fb.1.${Date.now()}.${touch.fbclid}`, cookie);
  return res;
}

export const config = {
  // pages only: not API routes, the owner area, Next.js assets or files with an extension (images, icons…)
  matcher: ["/((?!api/|admin|_next/|.*\\..*).*)"],
};
