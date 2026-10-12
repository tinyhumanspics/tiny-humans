const SITE_DOMAIN = "tinyhumans.photography";

/**
 * WebAuthn relying party for a request. On the live site the passkey belongs to tinyhumans.photography, so it works on
 * www. and the bare domain alike; elsewhere (localhost, Vercel previews) it belongs to that host. The expected origin
 * is the page's own origin (owner-area requests are same-origin; proxy.ts checks it).
 */
export function relyingParty(req: Pick<Request, "url">): { rpID: string; origin: string } {
  const url = new URL(req.url);
  const host = url.hostname;
  return { rpID: host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`) ? SITE_DOMAIN : host, origin: url.origin };
}

/** A friendly device name for the owner's list, from the browser's user agent. */
export function passkeyLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/CrOS/.test(ua)) return "Chromebook";
  return "This device";
}
