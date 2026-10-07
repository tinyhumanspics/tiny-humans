"use client";

import { normCity, normEmail, normPhoneUS, normZip, splitName } from "./normalize";

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
    if (typeof window !== "undefined" && typeof window.fbq === "function" && !location.pathname.startsWith("/admin")) window.fbq(...args);
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

/** The visitor started booking (the schedule step opened with a bundle). Once per bundle per browser session. */
export function trackBeginBooking(b: TrackBundle) {
  if (!firstTime(`ic_${b.id}`)) return;
  fbq("track", "InitiateCheckout", { content_name: b.name, content_ids: [b.id], content_type: "product", value: b.value, currency: "USD", num_items: 1 });
}

/**
 * A booking was created. eventId = the booking's requestId (the server sends the same event through the Conversions
 * API; Meta keeps one). Fires once per requestId even if the confirmation re-renders.
 */
export function trackBooked(b: TrackBundle & { eventId: string; contact: { parentName: string; email: string; phone: string }; address: { city: string; zip: string } }) {
  if (!b.eventId || !firstTime(`sched_${b.eventId}`)) return;
  const { fn, ln } = splitName(b.contact.parentName);
  const email = normEmail(b.contact.email);
  // advanced matching: the Pixel hashes these in the browser before sending
  const am: Record<string, string> = { em: email, ph: normPhoneUS(b.contact.phone), fn, ln, ct: normCity(b.address.city), st: "fl", zp: normZip(b.address.zip), country: "us", external_id: email };
  for (const k of Object.keys(am)) if (!am[k]) delete am[k];
  if (pixelId()) fbq("init", pixelId(), am);
  fbq("track", "Schedule", { content_name: b.name, content_ids: [b.id], content_type: "product", value: b.value, currency: "USD" }, { eventID: b.eventId });
}
