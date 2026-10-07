"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { safeAnalyticsUrl } from "@/lib/tracking/safe-url";

/** Strip private query values (cancel/reschedule tokens) and skip /admin before anything is sent. */
function scrub<E extends { url: string }>(event: E): E | null {
  const url = safeAnalyticsUrl(event.url);
  return url ? { ...event, url } : null;
}

/**
 * Vercel Web Analytics (cookieless page views) + Speed Insights (real-visitor performance).
 * Enabled per project in the Vercel dashboard; locally they only log in development and send nothing.
 */
export default function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={(event: BeforeSendEvent) => scrub(event)} />
      <SpeedInsights beforeSend={(event) => scrub(event)} />
    </>
  );
}
