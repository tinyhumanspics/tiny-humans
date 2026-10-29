"use client";

import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";
import type { AvailabilityRules, BookingLimits, CloseDayResult, ClosedDayImpact, DateOverride, TimeBlock, WeeklyDay } from "@/lib/availability/types";
import type { Lead, LeadFilter, LeadList } from "@/lib/leads/types";
import type { Dashboard } from "@/lib/admin/dashboard-types";
import type { TravelExample, TravelSettings } from "@/lib/travel/types";
import type { DepositSettings } from "@/lib/deposit/types";
import type { AdminBundle } from "@/lib/pricing/types";
import type { DiscountCode } from "@/lib/pricing/types";
import type { BundleInput, CodeInput } from "@/lib/pricing/validation";

/** What the owner area needs: the /api/admin routes. */
export interface AdminApi {
  session(): Promise<{ authenticated: boolean; authConfigured: boolean; storageConfigured: boolean }>;
  login(password: string): Promise<{ ok: boolean; error?: string }>;
  logout(): Promise<void>;
  getSettings(): Promise<SiteSettings>;
  saveSettings(settings: SiteSettings): Promise<SiteSettings>;
  getSpanishPublication(): Promise<SpanishPublicationStatus>;
  setSpanishPublication(enabled: boolean): Promise<{ settings: SiteSettings; status: SpanishPublicationStatus }>;
  uploadPhoto(file: Blob): Promise<{ src: string }>;
  /* availability (owner only) */
  getAvailability(): Promise<{ rules: AvailabilityRules; databaseConfigured: boolean }>;
  saveWeekly(weekly: WeeklyDay[], limits: BookingLimits): Promise<AvailabilityRules>;
  saveOverride(o: DateOverride): Promise<AvailabilityRules>;
  deleteOverride(date: string): Promise<AvailabilityRules>;
  closedDayImpact(date: string): Promise<ClosedDayImpact>;
  closeDayAndNotify(date: string, note?: string): Promise<CloseDayResult>;
  closeDayWithoutEmail(date: string): Promise<CloseDayResult>;
  addBlock(b: Omit<TimeBlock, "id">): Promise<AvailabilityRules>;
  deleteBlock(id: string): Promise<AvailabilityRules>;
  /** Travel fee settings (null = not saved yet, fees off) + example fees. */
  getTravel(): Promise<{ settings: TravelSettings | null; examples: TravelExample[]; databaseConfigured: boolean }>;
  saveTravel(s: TravelSettings): Promise<{ settings: TravelSettings | null; examples: TravelExample[] }>;
  /** Deposits on/off + each bundle's amount (null = the database or its table isn't there). `stripeReady`: Stripe can take them. */
  getDeposit(): Promise<{ settings: DepositSettings | null; stripeReady: boolean; databaseConfigured: boolean }>;
  saveDeposit(s: { enabled: boolean; amounts: Record<string, number> }): Promise<{ settings: DepositSettings | null; stripeReady: boolean }>;
  /* leads (owner only) */
  listLeads(filter: LeadFilter, offset?: number): Promise<LeadList>;
  dashboard(): Promise<Dashboard>;
  cancelLead(reference: string, reason: string, refundDeposit?: boolean): Promise<Lead>;
  /** Refund a paid deposit by hand (e.g. after a refund failed, or a kept deposit the owner gives back). */
  refundDeposit(reference: string): Promise<Lead>;
  /** The family's deposit link: emailed (`email`) or prepared to copy; a released time is held again first (if free). */
  depositLink(reference: string, email: boolean): Promise<Lead>;
  leadAvailability(reference: string, from: string, to: string): Promise<import("@/lib/booking/types").DayAvailability[]>;
  rescheduleLead(reference: string, slot: { date: string; start: string }): Promise<Lead>;
  deleteLead(reference: string): Promise<void>;
  /** After the session (server mode only). */
  sendSneakPeek(reference: string, galleryUrl: string, favorites: string): Promise<Lead>;
  galleryDelivered(reference: string, galleryUrl?: string, downloadPin?: string): Promise<Lead>;
  setReviewApproved(reference: string, approved: boolean): Promise<Lead>;
  setConsent(reference: string, change: { sms?: boolean; photos?: boolean }): Promise<Lead>;
  emailPaymentLink(reference: string): Promise<Lead>;
  /** "Check with Stripe": asks Stripe whether this booking was paid (backup for a missed webhook). */
  checkPayment(reference: string): Promise<Lead>;
  /* pricing & promotions (owner only) */
  getPricing(): Promise<{ bundles: AdminBundle[]; codes: DiscountCode[]; databaseConfigured: boolean }>;
  saveBundle(b: BundleInput): Promise<AdminBundle[]>;
  deleteBundle(id: string): Promise<AdminBundle[]>;
  saveCode(c: CodeInput): Promise<DiscountCode[]>;
  deleteCode(id: string): Promise<DiscountCode[]>;
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Try again.");
  return data as T;
}

const httpApi: AdminApi = {
  session: async () => json(await fetch("/api/admin/session", { cache: "no-store" })),
  login: async (password) => {
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as { error?: string }).error };
  },
  logout: async () => {
    await fetch("/api/admin/logout", { method: "POST" });
  },
  getSettings: async () => parseSettings(await json(await fetch("/api/admin/settings", { cache: "no-store" }))),
  saveSettings: async (s) =>
    parseSettings(await json(await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) }))),
  getSpanishPublication: async () => json(await fetch("/api/admin/spanish", { cache: "no-store" })),
  setSpanishPublication: async (enabled) => {
    const result = await json<{ settings: unknown; status: SpanishPublicationStatus }>(
      await fetch("/api/admin/spanish", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) }),
    );
    return { settings: parseSettings(result.settings), status: result.status };
  },
  uploadPhoto: async (file) => {
    const form = new FormData();
    form.append("file", file, "photo.jpg");
    return json(await fetch("/api/admin/photos", { method: "POST", body: form }));
  },
  getAvailability: async () => json(await fetch("/api/admin/availability", { cache: "no-store" })),
  saveWeekly: async (weekly, limits) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekly, limits }) }))).rules,
  saveOverride: async (o) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability/overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) }))).rules,
  deleteOverride: async (date) => (await json<{ rules: AvailabilityRules }>(await fetch(`/api/admin/availability/overrides?date=${date}`, { method: "DELETE" }))).rules,
  closedDayImpact: async (date) =>
    (await json<{ impact: ClosedDayImpact }>(await fetch(`/api/admin/availability/close-day?${new URLSearchParams({ date })}`, { cache: "no-store" }))).impact,
  closeDayAndNotify: async (date, note) =>
    json(await fetch("/api/admin/availability/close-day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, note, notify: true }) })),
  closeDayWithoutEmail: async (date) =>
    json(await fetch("/api/admin/availability/close-day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, notify: false }) })),
  addBlock: async (b) =>
    (await json<{ rules: AvailabilityRules }>(await fetch("/api/admin/availability/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }))).rules,
  deleteBlock: async (id) => (await json<{ rules: AvailabilityRules }>(await fetch(`/api/admin/availability/blocks?id=${id}`, { method: "DELETE" }))).rules,
  getTravel: async () => json(await fetch("/api/admin/travel", { cache: "no-store" })),
  saveTravel: async (s) => json(await fetch("/api/admin/travel", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) })),
  getDeposit: async () => json(await fetch("/api/admin/deposit", { cache: "no-store" })),
  saveDeposit: async (s) => json(await fetch("/api/admin/deposit", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) })),
  leadAvailability: async (reference, from, to) =>
    (await json<{ days: import("@/lib/booking/types").DayAvailability[] }>(await fetch(`/api/admin/leads/availability?${new URLSearchParams({ reference, from, to })}`, { cache: "no-store" }))).days,
  rescheduleLead: async (reference, slot) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/reschedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, ...slot }) }))).lead,
  getPricing: async () => json(await fetch("/api/admin/pricing", { cache: "no-store" })),
  saveBundle: async (b) => (await json<{ bundles: AdminBundle[] }>(await fetch("/api/admin/pricing/bundles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }))).bundles,
  deleteBundle: async (id) => (await json<{ bundles: AdminBundle[] }>(await fetch(`/api/admin/pricing/bundles?id=${encodeURIComponent(id)}`, { method: "DELETE" }))).bundles,
  saveCode: async (c) => (await json<{ codes: DiscountCode[] }>(await fetch("/api/admin/pricing/codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) }))).codes,
  deleteCode: async (id) => (await json<{ codes: DiscountCode[] }>(await fetch(`/api/admin/pricing/codes?id=${id}`, { method: "DELETE" }))).codes,
  deleteLead: async (reference) => {
    await json(await fetch("/api/admin/leads/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, confirm: "DELETE" }) }));
  },
  listLeads: async (filter, offset = 0) => json(await fetch(`/api/admin/leads?status=${filter}&offset=${offset}`, { cache: "no-store" })),
  dashboard: async () => json(await fetch("/api/admin/dashboard", { cache: "no-store" })),
  cancelLead: async (reference, reason, refundDeposit) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, reason, refundDeposit }) }))).lead,
  refundDeposit: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/deposit-refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  depositLink: async (reference, email) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/deposit-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, email }) }))).lead,
  sendSneakPeek: async (reference, galleryUrl, favorites) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/after-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, galleryUrl, favorites }) }))).lead,
  galleryDelivered: async (reference, galleryUrl, downloadPin) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/gallery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, galleryUrl, downloadPin }) }))).lead,
  setReviewApproved: async (reference, approved) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, approved }) }))).lead,
  setConsent: async (reference, change) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, ...change }) }))).lead,
  emailPaymentLink: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  checkPayment: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
};

export function getAdminApi(): AdminApi {
  return httpApi;
}

/** Shrink a photo in the browser before upload (max 2000px, JPEG). */
export async function preparePhoto(file: File, maxSide = 2000, quality = 0.86): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`"${file.name}" isn't a photo this browser can open.`));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that photo."))), "image/jpeg", quality));
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
