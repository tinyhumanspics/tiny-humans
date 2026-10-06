"use client";

import type { Bundle } from "@/config/bundles";
import { bookingRules } from "@/config/booking";
import { todayInZone } from "@/lib/booking/timezone";
import { builtInCatalog } from "./catalog";
import { toCents } from "./engine";
import { CODE_MESSAGES, type DiscountCode, type PricingAdapter } from "./types";

/** Prototype only: bundles + discount codes are kept in this browser. */
export const PROTOTYPE_PRICING_KEY = "tinyhumans:prototype-pricing";
export const PRICING_EVENT = "tinyhumans:pricing";

export interface PrototypePricing {
  bundles: Bundle[];
  codes: DiscountCode[];
}

export function readPrototypePricing(): PrototypePricing {
  try {
    const raw = window.localStorage.getItem(PROTOTYPE_PRICING_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PrototypePricing;
      if (Array.isArray(p.bundles) && p.bundles.length) return { bundles: p.bundles, codes: p.codes ?? [] };
    }
  } catch {
    /* fall through */
  }
  return { bundles: builtInCatalog(), codes: [] };
}

export function writePrototypePricing(p: PrototypePricing) {
  window.localStorage.setItem(PROTOTYPE_PRICING_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(PRICING_EVENT));
}

/** How many prototype bookings used a code (and whether this email already did). */
function usage(code: string, email?: string) {
  try {
    const recs = JSON.parse(window.localStorage.getItem("tinyhumans:prototype-bookings") ?? "[]") as { result: { pricing?: { discountCode?: string | null }; request: { contact: { email: string } } } }[];
    const used = recs.filter((r) => r.result.pricing?.discountCode === code);
    return { count: used.length, byEmail: Boolean(email && used.some((r) => r.result.request.contact.email.toLowerCase() === email.trim().toLowerCase())) };
  } catch {
    return { count: 0, byEmail: false };
  }
}

export function prototypeUsageCount(code: string) {
  return usage(code).count;
}

/** Same rules as the server, against this browser's prototype data. */
export const prototypePricingAdapter: PricingAdapter = {
  bundles: async () => readPrototypePricing().bundles,
  validateCode: async (raw, bundleId, email) => {
    const code = raw.trim().toUpperCase();
    const c = readPrototypePricing().codes.find((x) => x.code === code);
    if (!c) return { ok: false, message: CODE_MESSAGES.notFound };
    if (!c.active) return { ok: false, message: CODE_MESSAGES.inactive };
    if (c.expiresOn && todayInZone(bookingRules.timeZone) > c.expiresOn) return { ok: false, message: CODE_MESSAGES.expired };
    if (!c.bundleIds.includes(bundleId)) return { ok: false, message: CODE_MESSAGES.notForBundle };
    const u = usage(code, email);
    if (c.maxUses != null && u.count >= c.maxUses) return { ok: false, message: CODE_MESSAGES.maxed };
    if (c.onePerEmail && u.byEmail) return { ok: false, message: CODE_MESSAGES.usedByEmail };
    return { ok: true, codeId: c.id, terms: { code: c.code, type: c.type, value: c.type === "fixed" ? toCents(c.value) : c.value } };
  },
};
