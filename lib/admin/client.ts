"use client";

import { parseSettings } from "@/lib/settings/defaults";
import type { SiteSettings, SpanishPublicationStatus } from "@/lib/settings/types";
import type { AvailabilityRules, BookingLimits, CloseDayResult, ClosedDayImpact, DateOverride, TimeBlock, WeeklyDay } from "@/lib/availability/types";
import type { Lead, LeadFilter, LeadList } from "@/lib/leads/types";
import type { Dashboard } from "@/lib/admin/dashboard-types";
import type { TravelExample, TravelSettings } from "@/lib/travel/types";
import type { TripSettings } from "@/lib/booking/trips";
import type { DepositSettings } from "@/lib/deposit/types";
import type { AdminBundle } from "@/lib/pricing/types";
import type { DiscountCode } from "@/lib/pricing/types";
import type { BundleInput, CodeInput, OfferForAllInput } from "@/lib/pricing/validation";
import type { QuoteResult } from "@/lib/quotes/types";
import type { DueReservationRow } from "@/lib/due-date/types";
import type { FollowUpResult, UnfinishedData } from "@/lib/unfinished/types";
import type { QuickRequest } from "@/lib/quick/types";

/** /admin → Leads → Due dates. `ready` false = migration 0026 not run yet. */
export interface DueList {
  reservations: DueReservationRow[];
  ready: boolean;
  error?: string;
}

/** What the owner area needs: the /api/admin routes. */
/** /admin → Quotes / Booking: the family's price (GET /api/admin/booking/price). */
export interface OwnerPrice {
  quote: import("@/lib/booking/types").PriceQuote;
  travel: { status: string; miles: number | null; feeCents: number } | null;
  /** Bundle (offer or code) + extras + travel. */
  totalCents: number;
  /** Paid with their link; null = deposits off. */
  depositCents: number | null;
}

/** /admin → Quotes / Booking: what the owner fills in for a family (the booking form's fields). */
export interface OwnerBookingInput {
  bundleId: string;
  locale: "en" | "es";
  babies: { age: string; name?: string }[];
  family: { role: string; name?: string }[];
  slot: { date: string; start: string };
  contact: { parentName: string; email: string; phone: string; babyAge: string; babyName?: string; notes?: string };
  address: { street: string; unit?: string; city: string; zip: string; accessNotes?: string };
  discountCode?: string;
  requestId: string;
  /** Email the family their link now. */
  email: boolean;
}

export interface OwnerBookingResult {
  reference: string;
  /** pending = waiting on the deposit (the family's link); confirmed = deposits are off. */
  status: "pending" | "confirmed";
  url?: string;
  holdUntil?: string;
  /** The same message as a text to copy. */
  sms?: string;
  emailed: boolean;
  emailError?: string;
  pricing: import("@/lib/booking/types").PriceQuote | null;
  travel: { feeCents: number | null; miles: number | null } | null;
}

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
  /** Trip days: a far session takes the whole day (Availability → Travel). */
  getTrips(): Promise<{ settings: TripSettings }>;
  saveTrips(s: TripSettings): Promise<{ settings: TripSettings }>;
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
  /** Mark a lead "Completed" (moves to Leads → Completed) or take it back. */
  setCompleted(reference: string, completed: boolean): Promise<Lead>;
  emailPaymentLink(reference: string): Promise<Lead>;
  /** "Check with Stripe": asks Stripe whether this booking was paid (backup for a missed webhook). */
  checkPayment(reference: string): Promise<Lead>;
  /* pricing & promotions (owner only) */
  getPricing(): Promise<{ bundles: AdminBundle[]; codes: DiscountCode[]; databaseConfigured: boolean }>;
  saveBundle(b: BundleInput): Promise<AdminBundle[]>;
  deleteBundle(id: string): Promise<AdminBundle[]>;
  saveCode(c: CodeInput): Promise<DiscountCode[]>;
  deleteCode(id: string): Promise<DiscountCode[]>;
  /** The same "% off" offer on every active bundle; returns the bundles and how many got it. */
  applyOfferToAll(o: OfferForAllInput): Promise<{ bundles: AdminBundle[]; count: number }>;
  endOffersForAll(): Promise<AdminBundle[]>;
  /* due-date reservations ("Not born yet", owner only) */
  listDueDates(): Promise<DueList>;
  bookDueDate(input: { id: string; date: string; start: string; babyAge: string; babyName?: string }): Promise<DueList & { booked: string }>;
  cancelDueDate(id: string, refund: boolean): Promise<DueList & { refunded: boolean; refundError?: string }>;
  /** Leads → Not paid: email a "Not born yet" family the link to pay their missing deposit. */
  remindDueDeposit(id: string): Promise<{ ok: true; counted?: boolean }>;
  /** Leads → Not paid: delete a reservation whose deposit isn't paid (e.g. a test). */
  deleteDueDate(id: string): Promise<{ ok: true }>;
  /* quotes (owner only): every bundle's price for a ZIP code */
  getQuote(zip: string, babies: number, family: number, percent?: number): Promise<QuoteResult>;
  /** Quotes / Booking: open times for a family (no online minimum notice). */
  ownerSlots(q: { bundle: string; babies: number; zip: string; from: string; to: string }): Promise<import("@/lib/booking/types").DayAvailability[]>;
  /** Quotes / Booking: the price as the booking form works it out (offer or code, extras, travel, deposit). */
  ownerPrice(q: { bundle: string; babies: number; family: number; zip?: string; code?: string; email?: string }): Promise<OwnerPrice>;
  /** Quotes / Booking: book for a family; with deposits on they get a link (backdrops + deposit) and 48 hours. */
  ownerBook(input: OwnerBookingInput): Promise<OwnerBookingResult>;
  /** Quotes / Booking: what families sent through the quick form (/quick). `notReady` = migration 0034 not run yet. */
  listQuick(): Promise<{ requests: QuickRequest[]; notReady?: string }>;
  setQuickStatus(id: string, status: QuickRequest["status"], bookingReference?: string | null): Promise<void>;
  deleteQuick(id: string): Promise<void>;
  /* unfinished bookings (owner only); `period` = step counts' days + source */
  getUnfinished(period: UnfinishedPeriod): Promise<UnfinishedData>;
  saveMailingAddress(address: string, period: UnfinishedPeriod): Promise<UnfinishedData>;
  deleteUnfinished(id: string, period: UnfinishedPeriod): Promise<UnfinishedData>;
  sendUnfinishedFollowUp(target: { id: string } | { all: true }, period: UnfinishedPeriod): Promise<FollowUpResult>;
}

export interface UnfinishedPeriod {
  days: number;
  source: string | null;
}
const periodQuery = (p: UnfinishedPeriod, extra: Record<string, string> = {}) =>
  new URLSearchParams({ days: String(p.days), ...(p.source ? { source: p.source } : {}), ...extra }).toString();

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
  getTrips: async () => json(await fetch("/api/admin/trips", { cache: "no-store" })),
  saveTrips: async (s) => json(await fetch("/api/admin/trips", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) })),
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
  applyOfferToAll: async (o) => json(await fetch("/api/admin/pricing/offer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) })),
  endOffersForAll: async () => (await json<{ bundles: AdminBundle[] }>(await fetch("/api/admin/pricing/offer", { method: "DELETE" }))).bundles,
  listDueDates: async () => json(await fetch("/api/admin/due-dates", { cache: "no-store" })),
  bookDueDate: async (input) => json(await fetch("/api/admin/due-dates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "book", ...input }) })),
  cancelDueDate: async (id, refund) => json(await fetch("/api/admin/due-dates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", id, refund }) })),
  remindDueDeposit: async (id) => json(await fetch("/api/admin/due-dates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "remind", id }) })),
  deleteDueDate: async (id) => json(await fetch("/api/admin/due-dates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) })),
  ownerSlots: async (q) =>
    (await json<{ days: import("@/lib/booking/types").DayAvailability[] }>(await fetch(`/api/admin/booking/slots?${new URLSearchParams({ bundle: q.bundle, babies: String(q.babies), zip: q.zip, from: q.from, to: q.to })}`, { cache: "no-store" }))).days,
  ownerPrice: async (q) =>
    json<OwnerPrice>(
      await fetch(`/api/admin/booking/price?${new URLSearchParams(Object.entries({ bundle: q.bundle, babies: String(q.babies), family: String(q.family), zip: q.zip ?? "", code: q.code ?? "", email: q.email ?? "" }).filter(([, v]) => v))}`, { cache: "no-store" }),
    ),
  ownerBook: async (input) => json<OwnerBookingResult>(await fetch("/api/admin/booking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })),
  listQuick: async () => json(await fetch("/api/admin/quick", { cache: "no-store" })),
  setQuickStatus: async (id, status, bookingReference) => {
    await json(await fetch(`/api/admin/quick/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, ...(bookingReference !== undefined ? { bookingReference } : {}) }) }));
  },
  deleteQuick: async (id) => {
    await json(await fetch(`/api/admin/quick/${encodeURIComponent(id)}`, { method: "DELETE" }));
  },
  getQuote: async (zip, babies, family, percent = 0) => json(await fetch(`/api/admin/quote?${new URLSearchParams({ zip, babies: String(babies), family: String(family), percent: String(percent) })}`, { cache: "no-store" })),
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
  setCompleted: async (reference, completed) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, completed }) }))).lead,
  setConsent: async (reference, change) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, ...change }) }))).lead,
  emailPaymentLink: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  checkPayment: async (reference) =>
    (await json<{ lead: Lead }>(await fetch("/api/admin/leads/payment-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) }))).lead,
  getUnfinished: async (period) => json(await fetch(`/api/admin/unfinished?${periodQuery(period)}`, { cache: "no-store" })),
  saveMailingAddress: async (mailingAddress, period) =>
    json(await fetch(`/api/admin/unfinished?${periodQuery(period)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mailingAddress }) })),
  deleteUnfinished: async (id, period) => json(await fetch(`/api/admin/unfinished?${periodQuery(period, { id })}`, { method: "DELETE" })),
  sendUnfinishedFollowUp: async (target, period) =>
    json(await fetch(`/api/admin/unfinished/follow-up?${periodQuery(period)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(target) })),
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

/** "Fill in Spanish for me" (owner, Nov 11): is automatic translation on (ANTHROPIC_API_KEY in Vercel)? */
export async function translationStatus(): Promise<boolean> {
  const res = await fetch("/api/admin/translate", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return false;
  return Boolean(((await res.json()) as { on?: boolean }).on);
}

/** The owner's English website words → Spanish (same order). `on: false` = translation is off (the English comes back). */
export async function translateToSpanish(texts: string[]): Promise<{ on: boolean; spanish: string[] }> {
  const res = await fetch("/api/admin/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts }) });
  const data = (await res.json().catch(() => ({}))) as { on?: boolean; spanish?: string[]; error?: string };
  if (!res.ok || !Array.isArray(data.spanish)) throw new Error(data.error ?? "Couldn't translate just now.");
  return { on: Boolean(data.on), spanish: data.spanish };
}
