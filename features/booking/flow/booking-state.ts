import { bookingSteps, isBabyGender, isFamilyRole, MAX_FAMILY_MEMBERS, STEP, type BabyGender, type FamilyRole } from "@/config/booking";
import { BACKDROP_IDS } from "@/config/backdrops";
import { BookingApiError, type BookingConsents, type BookingResult, type DateKey, type TimeSlot } from "@/lib/booking";
import { isFloridaZip } from "@/lib/travel/types";
import { fill } from "@/lib/email/messages";
import { isDateKey } from "@/lib/validation/date-key";
import type en from "@/messages/en.json";

/* Booking form state, reducer and checks (no React): used by useBookingFlow and the step components. */

export interface ContactDraft {
  /** Step one (owner, Nov 13); joined with lastName into the booking's parent name. */
  firstName: string;
  /** The contact step, after the time. */
  lastName: string;
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

/** The parent's name as it's booked and saved: first + last. */
export const fullName = (c: Pick<ContactDraft, "firstName" | "lastName">) => `${c.firstName.trim()} ${c.lastName.trim()}`.trim();
/** A name saved as one line (a "Not born yet" reservation's link) → first name + the rest. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}
/** gender "" = not picked (it's optional). */
export type BabyDraft = { name: string; age: string; gender: "" | BabyGender };
/** Who else is in the photos (bundles that include the family); role "" = not picked yet. All of it is optional. */
export type FamilyDraft = { role: "" | FamilyRole; name: string };
export const emptyFamilyMember = (): FamilyDraft => ({ role: "", name: "" });

/**
 * The family as it's booked (owner, Nov 10: "it's just optional"): an empty row is left out, a name without a role is
 * kept as "other" (shown as "Family member"), names trimmed. Never blocks the booking.
 */
export function filledFamily(family: FamilyDraft[]): { role: FamilyRole; name?: string }[] {
  return family.flatMap((m) => {
    const name = m.name.trim();
    if (!m.role && !name) return [];
    return [{ role: m.role || "other", ...(name ? { name } : {}) }];
  });
}

export interface State {
  step: number;
  maxStep: number;
  bundleId: string | null;
  babies: BabyDraft[];
  /** Asked only on bundles that include the family (lib/booking/family.ts asksFamily); optional, starts empty. */
  family: FamilyDraft[];
  date: DateKey | null;
  slot: TimeSlot | null;
  /** The ZIP code the time was picked with: a different home ZIP on the contact step re-checks the time (trip days). */
  slotZip?: string;
  contact: ContactDraft;
  /** Optional permissions (unticked = no). */
  consents: BookingConsents;
  stepError: string | null;
  fieldErrors: ContactErrors;
  babyErrors: string[];
  familyErrors: string[];
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

const emptyContact: ContactDraft = { firstName: "", lastName: "", email: "", phone: "", notes: "", street: "", unit: "", city: "", zip: "", access: "" };

export const initialState: State = {
  step: STEP.you,
  maxStep: STEP.you,
  bundleId: null,
  babies: [{ name: "", age: "", gender: "" }],
  family: [],
  date: null,
  slot: null,
  contact: emptyContact,
  consents: { sms: false, photos: false },
  stepError: null,
  fieldErrors: {},
  babyErrors: [],
  familyErrors: [],
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
    && step >= STEP.you
    && step < bookingSteps.length
    && Number.isInteger(maxStep)
    && maxStep >= step
    && maxStep < bookingSteps.length
    && Array.isArray(babies)
    && babies.length >= 1
    && babies.length <= 3
    // gender is missing from drafts saved before it existed (Oct 17)
    && babies.every((baby) => isRecord(baby) && typeof baby.name === "string" && typeof baby.age === "string" && (baby.gender === undefined || baby.gender === "" || isBabyGender(baby.gender)))
    // family is missing from drafts saved before it existed (Nov 10)
    && (state.family === undefined || (Array.isArray(state.family) && state.family.length <= MAX_FAMILY_MEMBERS && state.family.every((m) => isRecord(m) && typeof m.name === "string" && (m.role === "" || isFamilyRole(m.role)))))
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
  | { type: "clearSlot" }
  | { type: "contact"; field: keyof ContactDraft; value: string }
  | { type: "babyCount"; count: number; slot?: TimeSlot | null }
  | { type: "baby"; index: number; field: keyof BabyDraft; value: string }
  | { type: "family"; index: number; field: keyof FamilyDraft; value: string }
  | { type: "familyAdd" }
  | { type: "familyRemove"; index: number }
  | { type: "consent"; field: keyof BookingConsents; value: boolean }
  | { type: "go"; step: number }
  | { type: "next" }
  | { type: "back" }
  | { type: "stepError"; message: string }
  | { type: "fieldErrors"; errors: ContactErrors; babyErrors?: string[]; familyErrors?: string[] }
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
      return { ...state, slot: action.slot, slotZip: state.contact.zip.trim().slice(0, 5), stepError: null };
    case "clearSlot":
      // the day too: it isn't open for this home, so nothing on the calendar should look picked
      return { ...state, date: null, slot: null, slotZip: undefined, maxStep: Math.min(state.maxStep, STEP.time) };
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
    case "family": {
      const family = state.family.map((m, i) => (i === action.index ? { ...m, [action.field]: action.value } : m));
      const familyErrors = [...state.familyErrors];
      familyErrors[action.index] = "";
      return { ...state, family, familyErrors };
    }
    case "familyAdd":
      return state.family.length >= MAX_FAMILY_MEMBERS ? state : { ...state, family: [...state.family, emptyFamilyMember()] };
    case "familyRemove":
      return { ...state, family: state.family.filter((_, i) => i !== action.index), familyErrors: state.familyErrors.filter((_, i) => i !== action.index) };
    case "consent":
      return { ...state, consents: { ...state.consents, [action.field]: action.value } };
    case "go":
      return action.step <= state.maxStep ? { ...state, step: action.step, stepError: null } : state;
    case "next": {
      const step = Math.min(state.step + 1, bookingSteps.length - 1);
      return { ...state, step, maxStep: Math.max(state.maxStep, step), stepError: null, fieldErrors: {}, babyErrors: [], familyErrors: [] };
    }
    case "back":
      return { ...state, step: Math.max(0, state.step - 1), stepError: null };
    case "stepError":
      return { ...state, stepError: action.message };
    case "fieldErrors":
      return { ...state, fieldErrors: action.errors, babyErrors: action.babyErrors ?? [], familyErrors: action.familyErrors ?? [] };
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

export const isEmail = (value: string) => EMAIL_RE.test(value.trim());

/** The ZIP code box (both steps): 5 digits, in Florida. */
export function zipError(zip: string, messages: typeof en.bookingFlow.details): string | null {
  if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) return messages.validation.zip;
  if (!isFloridaZip(zip)) return messages.travel.outsideFlorida;
  return null;
}

/**
 * The boxes of one step (owner, Nov 13): "you" = first name, email, ZIP code (enough for the calendar); "contact" =
 * first and last name, phone and the home address.
 */
export function validateContact(c: ContactDraft, messages: typeof en.bookingFlow.details, part: "you" | "contact" = "contact"): ContactErrors {
  const e: ContactErrors = {};
  if (c.firstName.trim().length < 1) e.firstName = messages.validation.firstName;
  if (part === "you" && !isEmail(c.email)) e.email = messages.validation.email;
  if (part === "contact") {
    if (c.lastName.trim().length < 1) e.lastName = messages.validation.lastName;
    if (c.phone.replace(/\D/g, "").length < 10) e.phone = messages.validation.phone;
    if (c.street.trim().length < 4) e.street = messages.validation.street;
    if (c.city.trim().length < 2) e.city = messages.validation.city;
  }
  const zip = zipError(c.zip, messages);
  if (zip) e.zip = zip;
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
