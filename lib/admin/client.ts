"use client";

import { defaultSettings, parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";
import type { AvailabilityRules, BookingLimits, CloseDayResult, ClosedDayBooking, ClosedDayImpact, DateOverride, TimeBlock, WeeklyDay } from "@/lib/availability/types";
import { blockSchema, closeDaySchema, overrideSchema, weeklyAndLimitsSchema } from "@/lib/availability/validation";
import { readPrototypeAvailability, writePrototypeAvailability } from "@/lib/availability/prototype";
import type { Lead, LeadFilter, LeadList } from "@/lib/leads/types";
import type { TravelExample, TravelSettings } from "@/lib/travel/types";
import type { DepositSettings } from "@/lib/deposit/types";
import { MockBookingProvider } from "@/lib/booking/mock-provider";
import type { AdminBundle, Bundle } from "@/config/bundles";
import type { DiscountCode } from "@/lib/pricing/types";
import { bundleInputSchema, codeInputSchema, type BundleInput, type CodeInput } from "@/lib/pricing/validation";
import { prototypeUsageCount, readPrototypePricing, writePrototypePricing } from "@/lib/pricing/prototype";
import { durationLabel } from "@/lib/pricing/engine";

/** What the owner area needs. Live site: HTTP API. Prototype: this browser only. */
export interface AdminApi {
  mode: "live" | "prototype";
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
  cancelLead(reference: string, reason: string, refundDeposit?: boolean): Promise<Lead>;
  /** Refund a paid deposit by hand (e.g. after a refund failed, or a kept deposit the owner gives back). */
  refundDeposit(reference: string): Promise<Lead>;
  leadAvailability(reference: string, from: string, to: string): Promise<import("@/lib/booking/types").DayAvailability[]>;
  rescheduleLead(reference: string, slot: { date: string; start: string }): Promise<Lead>;
  deleteLead(reference: string): Promise<void>;
  /** After the session (server mode only). */
  sendSneakPeek(reference: string, galleryUrl: string, favorites: string): Promise<Lead>;
  galleryDelivered(reference: string, galleryUrl?: string): Promise<Lead>;
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

export const IS_PROTOTYPE = process.env.NEXT_PUBLIC_PROTOTYPE === "1";
export const PROTOTYPE_PASSWORD = "tinyhumans";
export const PROTOTYPE_STORAGE_KEY = "tinyhumans:prototype-settings";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Try again.");
  return data as T;
}

const httpApi: AdminApi = {
  mode: "live",
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
  cancelLead: async (reference, reason, refundDeposit) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, reason, refundDeposit }) }))).lead,
  refundDeposit: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/deposit-refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  sendSneakPeek: async (reference, galleryUrl, favorites) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/after-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, galleryUrl, favorites }) }))).lead,
  galleryDelivered: async (reference, galleryUrl) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/gallery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, galleryUrl }) }))).lead,
  setReviewApproved: async (reference, approved) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, approved }) }))).lead,
  setConsent: async (reference, change) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, ...change }) }))).lead,
  emailPaymentLink: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  checkPayment: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
};

/** Prototype: validate like the server, then keep the rules in this browser. */
function protoSave(update: (r: AvailabilityRules) => AvailabilityRules): AvailabilityRules {
  const next = update(readPrototypeAvailability());
  next.overrides.sort((a, b) => a.date.localeCompare(b.date));
  next.blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  writePrototypeAvailability(next);
  return next;
}
const firstIssue = (r: { success: boolean; error?: { issues: { message: string }[] } }) => {
  if (!r.success) throw new Error(r.error?.issues[0]?.message ?? "Check the details and try again.");
};

const adminBundles = (bundles: Bundle[]): AdminBundle[] =>
  bundles.map((bundle) => ({ ...bundle, spanish: (bundle as Partial<AdminBundle>).spanish ?? null }));

export function readPrototypeSettings(): SiteSettings | null {
  try {
    const raw = window.localStorage.getItem(PROTOTYPE_STORAGE_KEY);
    return raw ? parseSettings(JSON.parse(raw), { allowDataUrls: true }) : null;
  } catch {
    return null;
  }
}

const prototypeApi: AdminApi = {
  mode: "prototype",
  session: async () => ({
    authenticated: (() => {
      try {
        return window.sessionStorage.getItem("tinyhumans:owner") === "1";
      } catch {
        return false;
      }
    })(),
    authConfigured: true,
    storageConfigured: true,
  }),
  login: async (password) => {
    await new Promise((r) => setTimeout(r, 300));
    if (password !== PROTOTYPE_PASSWORD) return { ok: false, error: "That password isn't right." };
    try {
      window.sessionStorage.setItem("tinyhumans:owner", "1");
    } catch {}
    return { ok: true };
  },
  logout: async () => {
    try {
      window.sessionStorage.removeItem("tinyhumans:owner");
    } catch {}
  },
  getSettings: async () => readPrototypeSettings() ?? defaultSettings,
  saveSettings: async (s) => {
    const saved = { ...parseSettings(s, { allowDataUrls: true }), updatedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      throw new Error("This browser ran out of preview storage. Use fewer or smaller photos in the prototype.");
    }
    return saved;
  },
  getSpanishPublication: async () => {
    const settings = readPrototypeSettings() ?? defaultSettings;
    return { enabled: settings.spanishPublished, published: settings.spanishPublished, issues: [] };
  },
  setSpanishPublication: async (enabled) => {
    const current = readPrototypeSettings() ?? defaultSettings;
    const settings = await prototypeApi.saveSettings({ ...current, spanishPublished: enabled });
    return { settings, status: { enabled, published: enabled, issues: [] } };
  },
  uploadPhoto: async (file) => {
    const src = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Couldn't read that photo."));
      r.readAsDataURL(file);
    });
    return { src };
  },
  getAvailability: async () => ({ rules: readPrototypeAvailability(), databaseConfigured: true }),
  saveWeekly: async (weekly, limits) => {
    firstIssue(weeklyAndLimitsSchema.safeParse({ weekly, limits }));
    return protoSave((r) => ({ ...r, weekly, limits }));
  },
  saveOverride: async (o) => {
    firstIssue(overrideSchema.safeParse(o));
    const clean: DateOverride = o.isClosed ? { date: o.date, isClosed: true } : o;
    return protoSave((r) => ({ ...r, overrides: [...r.overrides.filter((x) => x.date !== o.date), clean] }));
  },
  deleteOverride: async (date) => protoSave((r) => ({ ...r, overrides: r.overrides.filter((x) => x.date !== date) })),
  closedDayImpact: async (date) => {
    const bookings = new MockBookingProvider()
      .listLeads()
      .filter((lead) => lead.sessionDate === date && lead.status !== "cancelled")
      .map((lead) => ({ reference: lead.reference, parentName: lead.parentName, email: lead.email, phone: lead.phone, start: lead.start, end: lead.end, status: lead.status as ClosedDayBooking["status"], notification: null }));
    return { date, bookings };
  },
  closeDayAndNotify: async (date, note) => {
    firstIssue(closeDaySchema.safeParse({ date, note }));
    const rules = protoSave((r) => ({ ...r, overrides: [...r.overrides.filter((x) => x.date !== date), { date, isClosed: true }] }));
    const impact = await prototypeApi.closedDayImpact(date);
    return { rules, impact, sent: impact.bookings.map((booking) => booking.reference), alreadySent: [], failed: [] };
  },
  closeDayWithoutEmail: async (date) => {
    const rules = protoSave((r) => ({ ...r, overrides: [...r.overrides.filter((x) => x.date !== date), { date, isClosed: true }] }));
    return { rules, impact: await prototypeApi.closedDayImpact(date), sent: [], alreadySent: [], failed: [] };
  },
  addBlock: async (b) => {
    firstIssue(blockSchema.safeParse(b));
    return protoSave((r) => ({ ...r, blocks: [...r.blocks, { ...b, id: `blk-${Math.random().toString(36).slice(2, 10)}` }] }));
  },
  deleteBlock: async (id) => protoSave((r) => ({ ...r, blocks: r.blocks.filter((x) => x.id !== id) })),
  // travel fees need the live database (distances are calculated on the server)
  getTravel: async () => ({ settings: null, examples: [], databaseConfigured: false }),
  saveTravel: async () => {
    throw new Error("Not available in the prototype.");
  },
  // deposits need Stripe and the live database
  getDeposit: async () => ({ settings: null, stripeReady: false, databaseConfigured: false }),
  saveDeposit: async () => {
    throw new Error("Not available in the prototype.");
  },
  refundDeposit: async () => {
    throw new Error("Not available in the prototype.");
  },
  listLeads: async (filter) => {
    const all = new MockBookingProvider().listLeads();
    const { duplicateBookingsFor } = await import("@/lib/leads/duplicates");
    const duplicates = duplicateBookingsFor(all, all);
    const flagged = all.map((lead) => ({ ...lead, duplicate: duplicates.get(lead.reference) }));
    const counts = { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0 } as LeadList["counts"];
    flagged.forEach((l) => {
      counts[l.status] += 1;
      if (l.status !== "cancelled") counts.all += 1;
    });
    const leads = filter === "all" ? flagged.filter((l) => l.status !== "cancelled") : flagged.filter((l) => l.status === filter);
    return { leads, counts, total: leads.length };
  },
  leadAvailability: async (reference, from, to) => {
    const lead = new MockBookingProvider().listLeads().find((l) => l.reference === reference);
    return lead ? new MockBookingProvider(async () => readPrototypeAvailability()).getAvailability({ bundleId: lead.bundleId, from, to }) : [];
  },
  rescheduleLead: async (reference, slot) => {
    const mock = new MockBookingProvider(async () => readPrototypeAvailability());
    await mock.rescheduleBooking(reference, slot);
    return mock.listLeads().find((l) => l.reference === reference)!;
  },
  deleteLead: async (reference) => {
    new MockBookingProvider().deleteLead(reference);
  },
  getPricing: async () => {
    const p = readPrototypePricing();
    return { bundles: adminBundles(p.bundles), codes: p.codes.map((c) => ({ ...c, usesCount: prototypeUsageCount(c.code) })), databaseConfigured: true };
  },
  saveBundle: async (input) => {
    const r = bundleInputSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Check the bundle details.");
    const b = r.data;
    const p = readPrototypePricing();
    const id = b.id || `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
    const next: AdminBundle = { id, name: b.name, price: b.price, description: b.description || undefined, duration: durationLabel(b.durationMinutes), durationMinutes: b.durationMinutes, people: "", setups: "", photos: b.photos || "", features: b.features, locationNote: "We bring the studio to your home", cta: `Choose ${b.name}`, badge: b.badge || undefined, active: b.active, sortOrder: b.sortOrder ?? p.bundles.length, offer: b.offer ?? null, extraBaby: b.extraBaby, spanish: b.spanish ? { name: b.spanish.name, description: b.spanish.description || undefined, badge: b.spanish.badge || undefined, offerLabel: b.spanish.offerLabel || undefined, features: b.spanish.features } : null };
    const bundles = p.bundles.some((x) => x.id === id) ? p.bundles.map((x) => (x.id === id ? next : x)) : [...p.bundles, next];
    writePrototypePricing({ ...p, bundles });
    return adminBundles(bundles);
  },
  deleteBundle: async (id) => {
    const used = new MockBookingProvider().listLeads().filter((l) => l.bundleId === id).length;
    if (used) throw new Error(`This bundle has ${used} booking${used === 1 ? "" : "s"} in its history, so it can't be deleted. Turn it off (inactive) instead.`);
    const p = readPrototypePricing();
    const bundles = p.bundles.filter((b) => b.id !== id);
    writePrototypePricing({ bundles, codes: p.codes.map((c) => ({ ...c, bundleIds: c.bundleIds.filter((x) => x !== id) })) });
    return adminBundles(bundles);
  },
  saveCode: async (input) => {
    const r = codeInputSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Check the code details.");
    const c = r.data;
    const p = readPrototypePricing();
    if (p.codes.some((x) => x.code === c.code && x.id !== c.id)) throw new Error("A code with that name already exists.");
    const existing = p.codes.find((x) => x.id === c.id);
    const next: DiscountCode = { id: c.id ?? crypto.randomUUID(), code: c.code, type: c.type, value: c.value, bundleIds: c.bundleIds, active: c.active, expiresOn: c.expiresOn ?? null, maxUses: c.maxUses ?? null, onePerEmail: c.onePerEmail, internalNote: c.internalNote ?? null, usesCount: 0, createdAt: existing?.createdAt ?? new Date().toISOString() };
    const codes = existing ? p.codes.map((x) => (x.id === next.id ? next : x)) : [...p.codes, next];
    writePrototypePricing({ ...p, codes });
    return codes.map((x) => ({ ...x, usesCount: prototypeUsageCount(x.code) }));
  },
  deleteCode: async (id) => {
    const p = readPrototypePricing();
    const codes = p.codes.filter((c) => c.id !== id);
    writePrototypePricing({ ...p, codes });
    return codes.map((x) => ({ ...x, usesCount: prototypeUsageCount(x.code) }));
  },
  cancelLead: async (reference, reason) => {
    if (reason.trim().length < 3) throw new Error("Add a cancellation reason.");
    const mock = new MockBookingProvider();
    await mock.cancelBooking(reference, { reason: reason.trim(), by: "admin" });
    return mock.listLeads().find((l) => l.reference === reference)!;
  },
  // the prototype sends no emails and takes no payments
  sendSneakPeek: async () => {
    throw new Error("Not available in the prototype.");
  },
  galleryDelivered: async () => {
    throw new Error("Not available in the prototype.");
  },
  setReviewApproved: async () => {
    throw new Error("Not available in the prototype.");
  },
  setConsent: async () => {
    throw new Error("Not available in the prototype.");
  },
  emailPaymentLink: async () => {
    throw new Error("Not available in the prototype.");
  },
  checkPayment: async () => {
    throw new Error("Not available in the prototype.");
  },
};

export function getAdminApi(): AdminApi {
  return IS_PROTOTYPE ? prototypeApi : httpApi;
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
