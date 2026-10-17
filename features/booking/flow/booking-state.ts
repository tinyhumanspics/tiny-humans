import { bookingSteps, isBabyGender, STEP, type BabyGender } from "@/config/booking";
import { BACKDROP_IDS } from "@/config/backdrops";
import { BookingApiError, type BookingConsents, type BookingResult, type DateKey, type TimeSlot } from "@/lib/booking";
import { isFloridaZip } from "@/lib/travel/types";
import { fill } from "@/lib/email/messages";
import { isDateKey } from "@/lib/validation/date-key";
import type en from "@/messages/en.json";

/* Booking form state, reducer and checks (no React): used by useBookingFlow and the step components. */

export interface ContactDraft {
  parentName: string;
  email: string;
  phone: string;
  notes: string;
  /** We bring the studio to the family's home. */
  street: string;
  unit: string;
  city: string;
  zip: string;
  /** Gate code, parking, concierge. */
  access: string;
}

export type ContactErrors = Partial<Record<keyof ContactDraft, string>>;
/** gender "" = not picked (it's optional). */
export type BabyDraft = { name: string; age: string; gender: "" | BabyGender };

export interface State {
  step: number;
  maxStep: number;
  bundleId: string | null;
  babies: BabyDraft[];
  date: DateKey | null;
  slot: TimeSlot | null;
  contact: ContactDraft;
  /** Optional permissions (unticked = no). */
  consents: BookingConsents;
  stepError: string | null;
  fieldErrors: ContactErrors;
  babyErrors: string[];
  status: "editing" | "submitting" | "done";
  result: BookingResult | null;
}

export interface LanguageDraftPayload {
  state: State;
  backdrops: string[];
  month: string;
  appliedCode: string | null;
  openedAt: number;
  requestId: string | null;
}

const emptyContact: ContactDraft = { parentName: "", email: "", phone: "", notes: "", street: "", unit: "", city: "", zip: "", access: "" };

export const initialState: State = {
  step: STEP.date,
  maxStep: STEP.date,
  bundleId: null,
  babies: [{ name: "", age: "", gender: "" }],
  date: null,
  slot: null,
  contact: emptyContact,
  consents: { sms: false, photos: false },
  stepError: null,
  fieldErrors: {},
  babyErrors: [],
  status: "editing",
  result: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

export function isLanguageDraftPayload(value: unknown, bundleId: string): value is LanguageDraftPayload {
  if (!isRecord(value) || !isRecord(value.state)) return false;
  const state = value.state;
  const contact = state.contact;
  const consents = state.consents;
  const slot = state.slot;
  const babies = state.babies;
  const step = Number(state.step);
  const maxStep = Number(state.maxStep);
  return (
    state.bundleId === bundleId
    && Number.isInteger(step)
    && step >= STEP.date
    && step < bookingSteps.length
    && Number.isInteger(maxStep)
    && maxStep >= step
    && maxStep < bookingSteps.length
    && Array.isArray(babies)
    && babies.length >= 1
    && babies.length <= 3
    // gender is missing from drafts saved before it existed (Oct 17)
    && babies.every((baby) => isRecord(baby) && typeof baby.name === "string" && typeof baby.age === "string" && (baby.gender === undefined || baby.gender === "" || isBabyGender(baby.gender)))
    && isRecord(contact)
    && Object.keys(emptyContact).every((key) => typeof contact[key] === "string")
    && isRecord(consents)
    && typeof consents.sms === "boolean"
    && typeof consents.photos === "boolean"
    && (state.date === null || isDateKey(state.date))
    && (
      slot === null
      || (
        isRecord(slot)
        && typeof slot.id === "string"
        && isDateKey(slot.date)
        && typeof slot.start === "string"
        && /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start)
        && typeof slot.end === "string"
        && /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end)
        && typeof slot.label === "string"
      )
    )
    && Array.isArray(value.backdrops)
    && value.backdrops.every((id) => typeof id === "string" && (BACKDROP_IDS as string[]).includes(id))
    && typeof value.month === "string"
    && /^\d{4}-\d{2}$/.test(value.month)
    && (value.appliedCode === null || (typeof value.appliedCode === "string" && value.appliedCode.length <= 40))
    && typeof value.openedAt === "number"
    && Number.isFinite(value.openedAt)
    && (value.requestId === null || (typeof value.requestId === "string" && value.requestId.length <= 100))
  );
}

export type Action =
  | { type: "date"; date: DateKey }
  | { type: "slot"; slot: TimeSlot }
  | { type: "contact"; field: keyof ContactDraft; value: string }
  | { type: "babyCount"; count: number; slot?: TimeSlot | null }
  | { type: "baby"; index: number; field: keyof BabyDraft; value: string }
  | { type: "consent"; field: keyof BookingConsents; value: boolean }
  | { type: "go"; step: number }
  | { type: "next" }
  | { type: "back" }
  | { type: "stepError"; message: string }
  | { type: "fieldErrors"; errors: ContactErrors; babyErrors?: string[] }
  | { type: "submitting" }
  | { type: "done"; result: BookingResult }
  | { type: "submitFailed"; message: string }
  | { type: "restore"; state: State }
  | { type: "reset" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "date":
      return { ...state, date: action.date, slot: state.date === action.date ? state.slot : null, maxStep: state.date === action.date ? state.maxStep : Math.min(state.maxStep, STEP.time), stepError: null };
    case "slot":
      return { ...state, slot: action.slot, stepError: null };
    case "contact": {
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[action.field];
      return { ...state, contact: { ...state.contact, [action.field]: action.value }, fieldErrors };
    }
    case "babyCount": {
      const count = Math.max(1, Math.min(3, action.count));
      const babies = Array.from({ length: count }, (_, i) => state.babies[i] ?? { name: "", age: "", gender: "" });
      const slot = action.slot === undefined ? state.slot : action.slot;
      return { ...state, babies, slot, maxStep: slot === null ? Math.min(state.maxStep, STEP.time) : state.maxStep, stepError: null, babyErrors: [] };
    }
    case "baby": {
      const babies = state.babies.map((baby, i) => (i === action.index ? { ...baby, [action.field]: action.value } : baby));
      const babyErrors = [...state.babyErrors];
      babyErrors[action.index] = "";
      return { ...state, babies, babyErrors };
    }
    case "consent":
      return { ...state, consents: { ...state.consents, [action.field]: action.value } };
    case "go":
      return action.step <= state.maxStep ? { ...state, step: action.step, stepError: null } : state;
    case "next": {
      const step = Math.min(state.step + 1, bookingSteps.length - 1);
      return { ...state, step, maxStep: Math.max(state.maxStep, step), stepError: null, fieldErrors: {}, babyErrors: [] };
    }
    case "back":
      return { ...state, step: Math.max(0, state.step - 1), stepError: null };
    case "stepError":
      return { ...state, stepError: action.message };
    case "fieldErrors":
      return { ...state, fieldErrors: action.errors, babyErrors: action.babyErrors ?? [] };
    case "submitting":
      return { ...state, status: "submitting", stepError: null };
    case "done":
      return { ...state, status: "done", result: action.result };
    case "submitFailed":
      return { ...state, status: "editing", stepError: action.message };
    case "restore":
      return action.state;
    case "reset":
      return { ...initialState, bundleId: state.bundleId };
  }
}

/* ---------------- validation ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(c: ContactDraft, messages: typeof en.bookingFlow.details): ContactErrors {
  const e: ContactErrors = {};
  if (c.parentName.trim().length < 2) e.parentName = messages.validation.parentName;
  if (!EMAIL_RE.test(c.email.trim())) e.email = messages.validation.email;
  if (c.phone.replace(/\D/g, "").length < 10) e.phone = messages.validation.phone;
  if (c.street.trim().length < 4) e.street = messages.validation.street;
  if (c.city.trim().length < 2) e.city = messages.validation.city;
  if (!/^\d{5}(-\d{4})?$/.test(c.zip.trim())) e.zip = messages.validation.zip;
  else if (!isFloridaZip(c.zip)) e.zip = messages.travel.outsideFlorida;
  return e;
}

/* ---------------- helpers ---------------- */

export function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function flowDurationLabel(minutes: number, messages: typeof en.bookingFlow.summary): string {
  if (minutes < 120 || minutes % 30 !== 0) return fill(messages.durationMinutes, { minutes: String(minutes) });
  const hours = minutes / 60;
  return hours === 1 ? messages.durationHour : fill(messages.durationHours, { hours: String(hours) });
}

/** API messages are never trusted as display copy: every published locale owns its customer-facing errors. */
export function apiErrorMessage(err: unknown, messages: typeof en.bookingFlow, fallback: string): string {
  if (!(err instanceof BookingApiError)) return fallback;
  if (err.code === "network") return messages.errors.network;
  if (err.code === "rate_limited") return messages.errors.rateLimited;
  if (err.code === "slot_unavailable") return messages.errors.slotTaken;
  if (err.code === "in_progress") return messages.errors.inProgress;
  return fallback;
}
