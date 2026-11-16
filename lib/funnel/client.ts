import type { FunnelStep } from "@/config/funnel";

/** Browser side of the anonymous step counter. Fire and forget: it can never slow down or break the booking page. */

/** Once per step and bundle per browser session (going back and forth doesn't count twice). */
function firstTime(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked (private mode): count anyway */
  }
  return true;
}

export function countBookingStep(step: FunnelStep, bundleId: string) {
  if (!firstTime(`th_funnel_${step}_${bundleId}`)) return;
  try {
    void fetch("/api/booking/funnel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step, bundleId }), keepalive: true }).catch(() => undefined);
  } catch {
    /* old browsers without keepalive: skip */
  }
}
