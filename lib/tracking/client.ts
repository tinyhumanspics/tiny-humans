"use client";

import { neutralId, normEmail, normName, normPhoneUS, normZip } from "./normalize";
import { pixelAllowed } from "./safe-url";

/**
 * Browser-side conversion tracking. Components call these provider-neutral functions; each ad platform is an
 * adapter below (Meta today; Google Ads / TikTok can be added here without touching components).
 * Every call is a no-op when the platform isn't loaded (not configured, blocked, or in /admin). Never throws.
 *
 * Children's privacy: only the parent's contact details are ever passed (never baby names, ages or notes).
 */
type Fbq = ((...args: unknown[]) => void) & { disablePushState?: boolean };
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

const pixelId = () => process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const fbq = (...args: unknown[]) => {
  try {
    // never in /admin, never on pages whose links carry a secret token (brief 03)
    if (typeof window !== "undefined" && typeof window.fbq === "function" && pixelAllowed(location.pathname, location.search)) window.fbq(...args);
  } catch {
    /* tracking must never break the page */
  }
};
const once = new Set<string>();
const firstTime = (key: string) => {
  if (once.has(key)) return false;
  once.add(key);
  try {
    if (sessionStorage.getItem(`th_tr_${key}`)) return false;
    sessionStorage.setItem(`th_tr_${key}`, "1");
  } catch {
    /* storage unavailable (private mode): memory guard only */
  }
  return true;
};

export interface TrackBundle {
  id: string;
  name: string;
  /** Price shown for the bundle right now (USD). */
  value: number;
}

/** A page view on client-side navigation (the first load is tracked by the Pixel base code). */
export function trackPageView() {
  fbq("track", "PageView");
}

/** A bundle was selected (bundle card or landing page call to action). */
export function trackSelectBundle(b: TrackBundle) {
  fbq("track", "ViewContent", { content_name: b.name, content_ids: [b.id], content_type: "product", value: b.value, currency: "USD" });
}


/**
 * A request was saved and the server said this one counts as a Lead (one per person per 30 days). eventId = the
 * request's reference: the server sends the same Lead through the Conversions API and Meta keeps one. Neutral names
 * only (never "due date", "baby" or "newborn"). Advanced matching: the Pixel hashes these in the browser.
 */
export function trackLead(l: { eventId: string; bundleId: string; firstName: string; email: string; mobile: string; zip: string }) {
  if (!l.eventId || !firstTime(`lead_${l.eventId}`)) return;
  const email = normEmail(l.email);
  const am: Record<string, string> = { em: email, ph: normPhoneUS(l.mobile), fn: normName(l.firstName).split(" ")[0] ?? "", zp: normZip(l.zip), country: "us", external_id: email };
  for (const k of Object.keys(am)) if (!am[k]) delete am[k];
  if (pixelId()) fbq("init", pixelId(), am);
  const id = neutralId(l.bundleId);
  fbq("track", "Lead", { content_name: "request", ...(id ? { content_ids: [id] } : {}) }, { eventID: l.eventId });
}

/** A tap on a "text us" or "call us" link (sms: / tel:). */
export function trackContact() {
  fbq("track", "Contact", { content_name: "text" });
}
