"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { site } from "@/config/site";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { activeOffer, formatMoney, toCents, type PriceQuote } from "@/lib/pricing/engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import BabyLedNote from "./BabyLedNote";
import { babyAgeOptions, bookingSettings, bookingSteps, bundlesHref, STEP } from "@/config/booking";
import {
  addDays,
  fromDateKey,
  formatLongDate,
  formatTimeLabel,
  getBookingClient,
  BookingApiError,
  startOfDay,
  toDateKey,
  type BookingConsents,
  type BookingResult,
  type DateKey,
  type TimeSlot,
} from "@/lib/booking";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import { useBookingSelection } from "./BookingSelectionContext";
import { unitLine } from "@/lib/booking/templates";
import { isFloridaZip, type TravelQuote } from "@/lib/travel/types";
import { travelFeeValue, travelHint } from "@/lib/travel/format";
import { setupsOf } from "@/config/backdrops";
import { backdropNames } from "@/lib/booking/backdrop-names";
import BackdropPicker from "@/components/Backdrops/BackdropPicker";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import ChoiceCard from "./ChoiceCard";
import StepTracker from "./StepTracker";
import Confirmation from "./Confirmation";
import { rememberDepositReturn } from "@/lib/booking/deposit-return";
import type { DepositOffer } from "@/lib/deposit/types";
import { fill } from "@/lib/email/messages";
import Calendar from "./Calendar";
import InspirationThumb from "./InspirationThumb";
import Reveal, { INTRO_DONE_EVENT } from "@/components/Reveal/Reveal";
import { consumeBookingScroll, scrollToBooking } from "@/lib/scroll/booking";
import en from "@/messages/en.json";
import { trackBeginBooking, trackBooked } from "@/lib/tracking/client";
import { addPhotos, extraBabyLine, sessionMinutes, type BookingBaby } from "@/lib/booking/extra-babies";
import { CODE_MESSAGES } from "@/lib/pricing/types";
import styles from "./Booking.module.css";
import { cn } from "@/lib/cn";
import type { Bundle } from "@/config/bundles";
import type { AppLocale } from "@/i18n/config";

/* ---------------- state ---------------- */

interface ContactDraft {
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

type ContactErrors = Partial<Record<keyof ContactDraft, string>>;
type BabyDraft = { name: string; age: string };

interface State {
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

const emptyContact: ContactDraft = { parentName: "", email: "", phone: "", notes: "", street: "", unit: "", city: "", zip: "", access: "" };

const initialState: State = {
  step: STEP.date,
  maxStep: STEP.date,
  bundleId: null,
  babies: [{ name: "", age: "" }],
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

type Action =
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
  | { type: "reset" };

function reducer(state: State, action: Action): State {
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
      const babies = Array.from({ length: count }, (_, i) => state.babies[i] ?? { name: "", age: "" });
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
    case "reset":
      return { ...initialState, bundleId: state.bundleId };
  }
}

/* ---------------- validation ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateContact(c: ContactDraft, messages: typeof en.bookingFlow.details): ContactErrors {
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

/* ---------------- component ---------------- */

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function flowDurationLabel(minutes: number, messages: typeof en.bookingFlow.summary): string {
  if (minutes < 120 || minutes % 30 !== 0) return fill(messages.durationMinutes, { minutes: String(minutes) });
  const hours = minutes / 60;
  return hours === 1 ? messages.durationHour : fill(messages.durationHours, { hours: String(hours) });
}

function flowBabiesLabel(babies: BookingBaby[], messages: typeof en.bookingFlow.details): string {
  return babies
    .map((baby, index) => {
      const ageIndex = babyAgeOptions.indexOf(baby.age as (typeof babyAgeOptions)[number]);
      const age = ageIndex >= 0 ? messages.baby.ageOptions[ageIndex] : baby.age;
      return `${baby.name?.trim() || fill(messages.baby.number, { number: String(index + 1) })} (${age})`;
    })
    .join(", ");
}

function flowPricingRows(p: PriceQuote, bundle: Bundle, messages: typeof en.bookingFlow.review): [string, string][] {
  const labels = messages.labels;
  const rows: [string, string][] = [];
  if (p.pricingType === "offer") {
    rows.push(
      [labels.regularPrice, formatMoney(p.regularCents)],
      [bundle.offer?.label?.trim() || p.offerLabel || labels.specialOffer, formatMoney(p.offerCents ?? p.finalCents)],
    );
  }
  if (p.pricingType === "discount") {
    rows.push(
      [labels.regularPrice, formatMoney(p.regularCents)],
      [labels.discountCode, p.discountCode ?? ""],
      [labels.discount, `-${formatMoney(p.discountCents)}`],
    );
  }
  rows.push([labels.bundleTotal, formatMoney(p.finalCents)]);
  p.addons.forEach((addon) => rows.push([addon.quantity === 1 ? labels.extraBaby : labels.extraBabies, `${addon.quantity} × ${formatMoney(addon.unitPriceCents)} = ${formatMoney(addon.totalCents)}`]));
  if (p.addonsCents > 0) rows.push([labels.sessionTotalBeforeTravel, formatMoney(p.totalCents)]);
  return rows;
}

/** The booking calendar for one bundle (chosen on the bundles page). */
export default function Booking({ bundleId, locale = "en", messages }: { bundleId: string; locale?: AppLocale; messages: typeof en.bookingFlow }) {
  const id = "book";
  const provider = getBookingClient();
  // one id per submission: retries of the same booking can never double-book
  const requestIdRef = useRef<string | null>(null);
  // spam signals: when the booking box opened, and a hidden field only bots fill in
  const openedAt = useRef(Date.now());
  const [hp, setHp] = useState("");
  const selection = useBookingSelection();
  const [state, dispatch] = useReducer(reducer, { ...initialState, bundleId });
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // availability cache for the current bundle
  const [days, setDays] = useState<Record<DateKey, TimeSlot[]>>({});
  const [loadingDays, setLoadingDays] = useState(false);
  // "today" is the studio's (Miami) date, not the visitor's, so relatives booking from other time zones see the same calendar
  const { today: studioToday } = useCatalog();
  const earliest = addDays(startOfDay(fromDateKey(studioToday)), bookingSettings.minDaysAhead);
  const [month, setMonth] = useState(() => new Date(earliest.getFullYear(), earliest.getMonth(), 1));

  // Arriving from a bundle's "Choose …" button: show the whole booking box.
  useEffect(() => {
    const wantsBox = consumeBookingScroll() || window.location.hash === "#book";
    if (!wantsBox) return;
    if (document.documentElement.hasAttribute("data-intro")) {
      const onDone = () => window.setTimeout(() => scrollToBooking("smooth"), 60);
      window.addEventListener(INTRO_DONE_EVENT, onDone, { once: true });
      return () => window.removeEventListener(INTRO_DONE_EVENT, onDone);
    }
    // let the page change finish first
    const t = window.setTimeout(() => scrollToBooking("smooth"), 140);
    return () => window.clearTimeout(t);
  }, []);

  // reset cached availability whenever its inputs change
  useEffect(() => {
    setDays({});
  }, [state.bundleId, state.babies.length]);

  const loadMonth = useCallback(
    async (m: Date, bundleId: string, babyCount: number) => {
      setLoadingDays(true);
      try {
        const from = toDateKey(new Date(m.getFullYear(), m.getMonth(), 1));
        const to = toDateKey(new Date(m.getFullYear(), m.getMonth() + 1, 0));
        const result = await provider.getAvailability({ bundleId, babyCount, from, to });
        setDays((prev) => {
          const next = { ...prev };
          result.forEach((d) => (next[d.date] = d.slots));
          return next;
        });
      } catch (err) {
        dispatch({
          type: "stepError",
          message: err instanceof BookingApiError ? err.message : messages.errors.availability,
        });
      } finally {
        setLoadingDays(false);
      }
    },
    [messages.errors.availability, provider],
  );

  useEffect(() => {
    if (state.step >= STEP.date && state.bundleId) {
      void loadMonth(month, state.bundleId, state.babies.length);
    }
  }, [state.step, state.bundleId, state.babies.length, month, loadMonth]);

  // move focus to the step heading on step changes (not on first load)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    const panel = panelRef.current;
    if (panel && panel.getBoundingClientRect().top < 60) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }, [state.step, state.status]);

  const { photos } = useSiteSettings();
  const inspiration = findPhoto(photos, selection.inspirationId);
  const { getBundle, today } = useCatalog();
  const bundle = getBundle(state.bundleId);
  const addon = bundle ? extraBabyLine(bundle, state.babies.length) : null;
  // review-step price: always calculated by the server (the browser only displays it)
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  // travel fee estimate for the ZIP code (the server recalculates it when booking)
  const [travelEst, setTravelEst] = useState<{ zip: string; quote: TravelQuote | null } | null>(null);
  const zip = state.contact.zip.trim().slice(0, 5);
  const zipReady = /^\d{5}$/.test(zip) && isFloridaZip(zip);
  useEffect(() => {
    if (!zipReady) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/booking/travel?zip=${zip}`, { signal: ctrl.signal, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((j: { travel?: TravelQuote } | null) => setTravelEst({ zip, quote: j?.travel ?? null }))
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [zip, zipReady]);
  const travel = zipReady && travelEst?.zip === zip ? travelEst.quote : null;
  const travelChecking = zipReady && travelEst?.zip !== zip;
  const travelFee = travel?.status === "fee" ? travel.feeCents : 0;
  // optional backdrop picks, one per setup of the bundle
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const setups = bundle ? setupsOf([bundle.setups, ...bundle.features]) : 1;
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [checkingBabyCount, setCheckingBabyCount] = useState(false);
  const goTo = (step: number) => {
    if (state.step === STEP.review && step !== STEP.review) {
      setAppliedCode(null);
      setQuote(null);
    }
    dispatch({ type: "go", step });
  };
  const goBack = () => {
    if (state.step === STEP.review) {
      setAppliedCode(null);
      setQuote(null);
    }
    dispatch({ type: "back" });
  };
  const changeBabyCount = async (count: number) => {
    const nextCount = Math.max(1, Math.min(3, count));
    if (nextCount === state.babies.length || !state.bundleId) return;
    setCheckingBabyCount(true);
    try {
      let nextSlot = state.slot;
      if (state.date && state.slot) {
        const [day] = await provider.getAvailability({ bundleId: state.bundleId, babyCount: nextCount, from: state.date, to: state.date });
        nextSlot = day?.slots.find((slot) => slot.start === state.slot?.start) ?? null;
      }
      setQuote(null);
      setAppliedCode(null);
      setDays({});
      dispatch({ type: "babyCount", count: nextCount, slot: nextSlot });
      if (state.slot && !nextSlot) {
        dispatch({ type: "go", step: STEP.time });
        dispatch({ type: "stepError", message: messages.details.extraBabies.timeUnavailable });
      }
    } catch (err) {
      dispatch({ type: "stepError", message: err instanceof BookingApiError ? err.message : messages.details.extraBabies.checkFailed });
    } finally {
      setCheckingBabyCount(false);
    }
  };
  // this bundle's deposit today (paid on Stripe as the last step); null = none
  const [depositOffer, setDepositOffer] = useState<DepositOffer | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PROTOTYPE === "1") return;
    if (!bundleId) return;
    fetch(`/api/booking/deposit?bundle=${encodeURIComponent(bundleId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((o: DepositOffer | null) => setDepositOffer(o))
      .catch(() => undefined);
  }, [bundleId]);
  const bundleCents = bundle ? quote?.finalCents ?? activeOffer(bundle, today)?.cents ?? toCents(bundle.price) : 0;
  const beforeTravelCents = quote?.totalCents ?? bundleCents + (addon?.totalCents ?? 0);
  const totalCents = beforeTravelCents + travelFee;
  const depositCents = depositOffer?.amountCents ? Math.min(depositOffer.amountCents, totalCents) : 0;
  const deposit = formatMoney(depositCents);
  useEffect(() => {
    if (state.step !== STEP.review || !state.bundleId) return;
    provider.quote(state.bundleId, undefined, undefined, state.babies.length).then(setQuote).catch(() => setQuote(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.bundleId, state.babies.length]);

  // conversion tracking: the visitor started booking this bundle
  useEffect(() => {
    if (bundle) trackBeginBooking({ id: bundle.id, name: bundle.name, value: (activeOffer(bundle, today)?.cents ?? toCents(bundle.price)) / 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.id]);

  const next = () => {
    switch (state.step) {
      case STEP.date:
        if (!state.date) return dispatch({ type: "stepError", message: messages.errors.date });
        break;
      case STEP.time:
        if (!state.slot) return dispatch({ type: "stepError", message: messages.errors.time });
        break;
      case STEP.details: {
        const errors = validateContact(state.contact, messages.details);
        const babyErrors = state.babies.map((baby) => (baby.age ? "" : messages.details.baby.ageError));
        const tooFar = travel?.status === "too_far" ? travelHint(travel, messages.details.travel) : null;
        if (tooFar && !errors.zip) errors.zip = tooFar.text;
        if (Object.keys(errors).length || babyErrors.some(Boolean)) {
          dispatch({ type: "fieldErrors", errors, babyErrors });
          const first = Object.keys(errors)[0];
          const firstBaby = babyErrors.findIndex(Boolean);
          requestAnimationFrame(() => (first ? document.getElementById(`field-${first}`) : document.getElementById(firstBaby === 0 ? "field-babyAge" : `field-baby-${firstBaby}-age`))?.focus());
          return;
        }
        break;
      }
    }
    dispatch({ type: "next" });
  };

  const submit = async () => {
    if (!state.bundleId || !state.slot) return;
    dispatch({ type: "submitting" });
    try {
      const c = state.contact;
      const babies: BookingBaby[] = state.babies.map((baby) => ({ name: baby.name.trim() || undefined, age: baby.age }));
      const request = {
        bundleId: state.bundleId,
        locale,
        babies,
        slot: state.slot,
        inspirationPhotoId: inspiration?.id,
        discountCode: appliedCode ?? undefined,
        contact: {
          parentName: c.parentName.trim(),
          email: c.email.trim(),
          phone: c.phone.trim(),
          babyName: babies[0].name,
          babyAge: babies[0].age,
          notes: c.notes.trim() || undefined,
        },
        address: { street: c.street.trim(), unit: c.unit.trim() || undefined, city: c.city.trim(), zip: c.zip.trim(), accessNotes: c.access.trim() || undefined },
        consents: state.consents,
        backdrops: backdrops.length ? backdrops.slice(0, setups) : undefined,
        requestId: (requestIdRef.current ??= newRequestId()),
        hp: hp || undefined,
        elapsedMs: Date.now() - openedAt.current,
      };
      let result: BookingResult | null = null;
      for (let attempt = 0; !result; attempt++) {
        try {
          result = await provider.createBooking(request);
        } catch (err) {
          // The first try is still being saved on the server: wait and ask again with the SAME requestId.
          if (err instanceof BookingApiError && err.code === "in_progress" && attempt < 8) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw err;
        }
      }
      // not booked yet: the deposit's Stripe page confirms it (the family comes back to this page)
      if (result.status === "pending" && result.deposit?.url) {
        if (result.deposit.returnPath) rememberDepositReturn(result.deposit.returnPath, result.deposit.holdUntil);
        setRedirecting(true);
        window.location.assign(result.deposit.url);
        return;
      }
      requestIdRef.current = null;
      if (result.status === "confirmed") {
        trackBooked({
          eventId: request.requestId,
          id: request.bundleId,
          name: result.pricing?.bundleName ?? bundle?.name ?? request.bundleId,
          value: ((result.pricing?.totalCents ?? result.pricing?.finalCents ?? 0) + (result.travel?.feeCents ?? 0)) / 100,
          contact: request.contact,
          address: request.address,
        });
      }
      dispatch({ type: "done", result });
    } catch (err) {
      if (err instanceof BookingApiError && err.code === "slot_unavailable" && state.slot) {
        // that time is gone: drop it and send the family back to pick another
        const taken = state.slot;
        requestIdRef.current = null;
        setDays((prev) => ({ ...prev, [taken.date]: (prev[taken.date] ?? []).filter((x) => x.id !== taken.id) }));
        goTo(STEP.time);
        dispatch({ type: "stepError", message: err.message });
        return;
      }
      dispatch({
        type: "submitFailed",
        message: err instanceof BookingApiError ? err.message : messages.errors.submit,
      });
    }
  };

  const daySlots = state.date ? days[state.date] : undefined;

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={messages.section.title} subtitle={messages.section.subtitle} slot="book" />
        {state.status !== "done" && bundle && (
          <div className={styles.bundleSummary}>
            {inspiration && <InspirationThumb photo={inspiration} size={44} />}
            <div className={styles.summaryText}>
              <p className="chalk-soft">
                <span className={styles.chipLabel}>{messages.summary.yourBundle}</span>{" "}
                <span className={styles.bundleName}>{bundle.name}</span>
                <span className={styles.bundleMeta}>
                  {formatMoney(activeOffer(bundle, today)?.cents ?? toCents(bundle.price))} · {bundle.duration}{bundle.photos ? ` · ${fill(messages.summary.editedPhotos, { count: bundle.photos })}` : ""}
                </span>
                {addon && <span className={styles.bundleMeta}>{addon.quantity === 1 ? messages.summary.extraBaby : messages.summary.extraBabies}: +{formatMoney(addon.totalCents)} · {fill(messages.summary.totalDuration, { duration: flowDurationLabel(sessionMinutes(bundle, state.babies.length), messages.summary) })} · {fill(messages.summary.editedPhotos, { count: addPhotos(bundle.photos, addon.extraPhotos) })}</span>}
              </p>
              {inspiration && (
                <p className={cn(styles.summaryPhoto, "chalk-soft")}>
                  <span className={styles.chipLabel}>{messages.summary.inspiredBy}</span> {inspiration.title}{" "}
                  <button type="button" className={cn(styles.inlineLink, "chalk-soft")} onClick={() => selection.setInspirationId(null)} aria-label={messages.summary.removeInspiration}>
                    {messages.summary.remove}
                  </button>
                </p>
              )}
            </div>
            <Link href={bundlesHref(selection.inspirationId, locale)} className={cn(styles.linkButton, "chalk-soft")}>
              {messages.summary.changeBundle}
            </Link>
          </div>
        )}
        <BabyLedNote messages={messages.babyLed} multiple={state.babies.length > 1} />

        <Reveal>
        <div ref={panelRef} className={styles.panelAnchor} data-booking-panel>
          <ChalkBox className={styles.panel} seed={7} wobble={4} strokeWidth={3}>
            {state.status === "done" && state.result ? (
              <Confirmation
                result={state.result}
                travelEstimate={travel ? { feeCents: travel.status === "fee" ? travel.feeCents : 0, miles: travel.miles } : undefined}
                headingRef={headingRef}
                onReset={() => router.push(bundlesHref(undefined, locale))}
              />
            ) : (
              <>
                <StepTracker current={state.step} maxReached={state.maxStep} onGo={goTo} messages={messages} />

                <div className={styles.stepBody}>
                  <h3 ref={headingRef} tabIndex={-1} className={cn(styles.stepTitle, "chalk")}>
                    {messages.steps[state.step].title}
                  </h3>

                  {state.step === STEP.date && (
                    <Calendar
                        todayKey={studioToday}
                        month={month}
                        onMonthChange={setMonth}
                        days={days}
                        loading={loadingDays}
                        selected={state.date}
                        onSelect={(d) => dispatch({ type: "date", date: d })}
                        messages={messages.calendar}
                        locale={locale}
                      />
                  )}

                  {state.step === STEP.time && state.date && (
                    <fieldset className={styles.fieldset}>
                      <legend className={cn(styles.subtle, "chalk-soft")}>{formatLongDate(state.date, locale)} · {messages.time.zone}</legend>
                      {daySlots === undefined ? (
                        <p className={cn(styles.subtle, "chalk-soft")}>{messages.time.checking}</p>
                      ) : daySlots.length === 0 ? (
                        <p className={cn(styles.subtle, "chalk-soft")}>{messages.time.filled}</p>
                      ) : (
                        <div className={styles.slots}>
                          {daySlots.map((slot, i) => (
                            <ChoiceCard
                              key={slot.id}
                              name="time"
                              value={slot.id}
                              seed={400 + i}
                              checked={state.slot?.id === slot.id}
                              onSelect={() => dispatch({ type: "slot", slot })}
                              title={formatTimeLabel(slot.start, locale)}
                              detail={fill(messages.time.until, { time: formatTimeLabel(slot.end, locale) })}
                            />
                          ))}
                        </div>
                      )}
                    </fieldset>
                  )}

                  {state.step === STEP.details && (
                    <DetailsForm
                      contact={state.contact}
                      errors={state.fieldErrors}
                      onChange={(field, value) => dispatch({ type: "contact", field, value })}
                      babies={state.babies}
                      babyErrors={state.babyErrors}
                      onBabyChange={(index, field, value) => dispatch({ type: "baby", index, field, value })}
                      bundle={bundle!}
                      checkingBabyCount={checkingBabyCount}
                      onBabyCountChange={changeBabyCount}
                      consents={state.consents}
                      onConsent={(field, value) => dispatch({ type: "consent", field, value })}
                      hp={hp}
                      onHp={setHp}
                      backdrops={backdrops}
                      onBackdrops={setBackdrops}
                      setups={setups}
                      messages={messages.details}
                      zipNote={
                        /^\d{5}$/.test(zip) && !isFloridaZip(zip)
                          ? { text: messages.details.travel.outsideFlorida, blocking: true }
                          : travelChecking
                            ? { text: messages.details.travel.checking, blocking: false }
                            : travel
                              ? travelHint(travel, messages.details.travel)
                              : null
                      }
                    />
                  )}

                  {state.step === STEP.review && bundle && state.date && state.slot && (
                    <Review
                      messages={messages.review}
                      rows={[
                        { label: messages.review.labels.package, value: bundle.name, step: -1, href: bundlesHref(selection.inspirationId, locale) },
                        ...(quote
                          ? flowPricingRows(quote, bundle, messages.review)
                          : ([
                              [messages.review.labels.bundleTotal, formatMoney(bundleCents)],
                              ...(addon ? [[addon.quantity === 1 ? messages.review.labels.extraBaby : messages.review.labels.extraBabies, `${addon.quantity} × ${formatMoney(addon.unitPriceCents)} = ${formatMoney(addon.totalCents)}`]] : []),
                              ...(addon ? [[messages.review.labels.sessionTotalBeforeTravel, formatMoney(beforeTravelCents)]] : []),
                            ] as [string, string][])
                        ).map(([label, value]) => ({ label, value, step: -1 })),
                        ...(travelFee > 0
                          ? [
                              { label: messages.review.labels.travelFee, value: travelFeeValue(travelFee, travel?.miles ?? null, messages.details.travel), step: STEP.details },
                              { label: messages.review.labels.total, value: formatMoney(beforeTravelCents + travelFee), step: -1 },
                            ]
                          : []),
                        ...(depositCents > 0
                          ? [
                              { label: messages.review.deposit.today, value: fill(messages.review.deposit.value, { deposit }), step: -1 },
                              { label: messages.review.deposit.rest, value: formatMoney(totalCents - depositCents), step: -1 },
                            ]
                          : [{ label: messages.review.labels.paymentDue, value: messages.review.labels.afterPhotoshoot, step: -1 }]),
                        ...(inspiration ? [{ label: messages.review.labels.inspiration, value: inspiration.title, step: -1, photo: inspiration }] : []),
                        { label: messages.review.labels.date, value: formatLongDate(state.date, locale), step: STEP.date },
                        { label: messages.review.labels.time, value: fill(messages.review.timeRange, { start: formatTimeLabel(state.slot.start, locale), end: formatTimeLabel(state.slot.end, locale), zone: messages.time.zone }), step: STEP.time },
                        { label: messages.review.labels.location, value: `${[state.contact.street.trim(), unitLine(state.contact.unit, messages.review.unit), state.contact.city.trim()].filter(Boolean).join(", ")} ${state.contact.zip.trim()}`, step: STEP.details },
                        ...(state.contact.access.trim() ? [{ label: messages.review.labels.access, value: state.contact.access.trim(), step: STEP.details }] : []),
                        { label: messages.review.labels.parent, value: state.contact.parentName, step: STEP.details },
                        { label: messages.review.labels.email, value: state.contact.email, step: STEP.details },
                        { label: messages.review.labels.phone, value: state.contact.phone, step: STEP.details },
                        { label: state.babies.length > 1 ? messages.review.labels.babies : messages.review.labels.baby, value: flowBabiesLabel(state.babies, messages.details), step: STEP.details },
                        ...(state.contact.notes.trim() ? [{ label: messages.review.labels.notes, value: state.contact.notes.trim(), step: STEP.details }] : []),
                        { label: setups > 1 ? messages.review.labels.backdrops : messages.review.labels.backdrop, value: backdrops.length ? backdropNames(backdrops, messages.details.backdrops.names, messages.review.and) : messages.review.labels.backdropNone, step: STEP.details },
                        { label: messages.review.labels.texts, value: state.consents.sms ? messages.review.labels.textsYes : messages.review.labels.textsNo, step: STEP.details },
                        { label: messages.review.labels.photos, value: state.consents.photos ? messages.review.labels.photosYes : messages.review.labels.photosNo, step: STEP.details },
                      ]}
                      onEdit={goTo}
                    />
                  )}

                  {state.step === STEP.review && bundle && (
                    <DiscountField
                      key={bundle.id}
                      applied={appliedCode}
                      messages={messages.review.discount}
                      offerLabel={bundle.offer?.label?.trim() || messages.review.labels.specialOffer}
                      onApply={async (code) => {
                        const q = await provider.quote(bundle.id, code, state.contact.email.trim(), state.babies.length);
                        setQuote(q);
                        setAppliedCode(q.pricingType === "discount" ? q.discountCode : null);
                        return q;
                      }}
                      onRemove={async () => {
                        setAppliedCode(null);
                        setQuote(await provider.quote(bundle.id, undefined, undefined, state.babies.length).catch(() => null));
                      }}
                    />
                  )}
                  {state.step === STEP.review && <BabyLedNote messages={messages.babyLed} compact multiple={state.babies.length > 1} />}
                  {state.step === STEP.review && depositCents > 0 && depositOffer && (
                    <p className={cn(styles.depositNote, "chalk-soft")}>{fill(messages.review.deposit.note, { notice: noticeLabel(depositOffer.noticeHours, messages.review.deposit.notice) })}</p>
                  )}

                  {state.stepError && (
                    <p className={cn(styles.error, "chalk-soft")} role="alert">
                      {state.stepError}
                    </p>
                  )}
                </div>

                <div className={styles.actions}>
                  {state.step > 0 ? (
                    <ChalkButton variant="outline" onClick={goBack} seed={81}>
                      {messages.actions.back}
                    </ChalkButton>
                  ) : (
                    <span />
                  )}
                  {state.step < bookingSteps.length - 1 ? (
                    <ChalkButton variant="solid" onClick={next} seed={82}>
                      {fill(messages.actions.next, { label: messages.steps[state.step + 1].label })}
                    </ChalkButton>
                  ) : (
                    <ChalkButton variant="solid" onClick={submit} disabled={state.status === "submitting"} seed={83}>
                      {redirecting ? messages.review.deposit.opening : state.status === "submitting" ? messages.actions.booking : depositCents > 0 ? fill(messages.review.deposit.button, { deposit }) : messages.actions.book}
                    </ChalkButton>
                  )}
                </div>
              </>
            )}
          </ChalkBox>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- twins / triplets choice (after Baby 1 on the details step) ---------------- */

function ExtraBabiesPicker({ bundle, count, checking, onChange, messages }: { bundle: Bundle; count: number; checking: boolean; onChange: (count: number) => void; messages: typeof en.bookingFlow.details.extraBabies }) {
  const addon = bundle.extraBaby;
  const [expanded, setExpanded] = useState(count > 1);
  if (!addon?.active) return null;
  const max = Math.min(3, addon.maxBabies);
  const choices = [
    { count: 2, label: messages.two, price: addon.price, minutes: addon.extraMinutes, photos: addon.extraPhotos },
    { count: 3, label: messages.three, price: addon.price * 2, minutes: addon.extraMinutes * 2, photos: addon.extraPhotos * 2 },
  ].filter((choice) => choice.count <= max);
  return (
    <div className={styles.extraBabiesPrompt}>
      <p className={cn(styles.extraBabiesIncluded, "chalk-soft")}>{messages.included}</p>
      <button type="button" className={cn(styles.extraBabiesToggle, "chalk-soft")} aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
        {messages.question}
      </button>
      <p className={cn(styles.extraBabiesHint, "chalk-soft")}>
        {fill(messages.details, { price: formatMoney(toCents(addon.price)), minutes: String(addon.extraMinutes), photos: String(addon.extraPhotos) })} {messages.fullPrice}
      </p>
      {expanded && (
        <div className={styles.extraBabiesChoices} role="group" aria-label={messages.choose}>
          {choices.map((choice) => (
            <button
              key={choice.count}
              type="button"
              className={cn(styles.extraBabyChoice, count === choice.count ? styles.extraBabyChoiceSelected : "", "chalk-soft")}
              aria-pressed={count === choice.count}
              disabled={checking}
              onClick={() => onChange(choice.count)}
            >
              <strong>{choice.label}</strong>
              <span>{fill(messages.choice, { price: formatMoney(toCents(choice.price)), minutes: String(choice.minutes), photos: String(choice.photos) })}</span>
            </button>
          ))}
          {count > 1 && (
            <button type="button" className={cn(styles.oneBabyButton, "chalk-soft")} disabled={checking} onClick={() => onChange(1)}>
              {messages.one}
            </button>
          )}
        </div>
      )}
      {checking && <p className={cn(styles.extraBabiesChecking, "chalk-soft")} role="status">{messages.checking}</p>}
    </div>
  );
}

/* ---------------- details form ---------------- */

function DetailsForm({
  contact,
  errors,
  onChange,
  babies,
  babyErrors,
  onBabyChange,
  bundle,
  checkingBabyCount,
  onBabyCountChange,
  consents,
  onConsent,
  hp,
  onHp,
  zipNote,
  backdrops,
  onBackdrops,
  setups,
  messages,
}: {
  contact: ContactDraft;
  errors: ContactErrors;
  onChange: (field: keyof ContactDraft, value: string) => void;
  babies: BabyDraft[];
  babyErrors: string[];
  onBabyChange: (index: number, field: keyof BabyDraft, value: string) => void;
  bundle: Bundle;
  checkingBabyCount: boolean;
  onBabyCountChange: (count: number) => void;
  consents: BookingConsents;
  onConsent: (field: keyof BookingConsents, value: boolean) => void;
  hp: string;
  onHp: (v: string) => void;
  /** Travel fee line under the ZIP box. */
  zipNote: { text: string; blocking: boolean } | null;
  backdrops: string[];
  onBackdrops: (picks: string[]) => void;
  /** Backdrops they can pick (one per setup). */
  setups: number;
  messages: typeof en.bookingFlow.details;
}) {
  /** Newborns up to 2 years for now: the note under the age box, split around the email link. */
  const olderNote = messages.baby.olderNote.split("{email}");
  const field = (
    name: keyof ContactDraft,
    label: string,
    opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" | "text" | "numeric"; maxLength?: number } = {},
  ) => {
    const errId = `field-${name}-error`;
    return (
      <div className={styles.field}>
        <label htmlFor={`field-${name}`} className={cn(styles.label, "chalk-soft")}>
          {label}
          {opts.optional && <span className={styles.optional}>{messages.optional}</span>}
        </label>
        <input
          id={`field-${name}`}
          className={styles.input}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          maxLength={opts.maxLength}
          value={contact[name]}
          onChange={(e) => onChange(name, e.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errId : undefined}
          required={!opts.optional}
        />
        {errors[name] && (
          <p id={errId} className={cn(styles.fieldError, "chalk-soft")}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  const babyCard = (baby: BabyDraft, index: number) => {
    const nameId = index === 0 ? "field-babyName" : `field-baby-${index}-name`;
    const ageId = index === 0 ? "field-babyAge" : `field-baby-${index}-age`;
    const errorId = `${ageId}-error`;
    return (
      <div key={index} className={styles.babyCard}>
        {babies.length > 1 && <p className={cn(styles.babyTitle, "chalk-soft")}>{fill(messages.baby.number, { number: String(index + 1) })}</p>}
        <label htmlFor={nameId} className={cn(styles.label, "chalk-soft")}>{messages.baby.name}<span className={styles.optional}>{messages.optional}</span></label>
        <input id={nameId} className={styles.input} value={baby.name} maxLength={80} autoComplete="off" onChange={(e) => onBabyChange(index, "name", e.target.value)} />
        <label htmlFor={ageId} className={cn(styles.label, "chalk-soft")}>{messages.baby.age}</label>
        <select id={ageId} className={styles.input} value={baby.age} onChange={(e) => onBabyChange(index, "age", e.target.value)} aria-invalid={Boolean(babyErrors[index])} aria-describedby={[babyErrors[index] && errorId, site.contact.email && "field-babyAge-hint"].filter(Boolean).join(" ") || undefined} required>
          <option value="">{messages.baby.chooseAge}</option>
          {babyAgeOptions.map((a, optionIndex) => <option key={a} value={a}>{messages.baby.ageOptions[optionIndex]}</option>)}
        </select>
        {babyErrors[index] && <p id={errorId} className={cn(styles.fieldError, "chalk-soft")}>{babyErrors[index]}</p>}
      </div>
    );
  };

  return (
    <div className={styles.form}>
      {/* Honeypot: hidden from people and screen readers; automated form-fillers tend to fill it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="th-leave-empty">{messages.honeypot}</label>
        <input id="th-leave-empty" name="th-leave-empty" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => onHp(e.target.value)} />
      </div>
      {field("parentName", messages.parentName, { autoComplete: "name" })}
      {field("email", messages.email, { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("phone", messages.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      <div className={cn(styles.fieldWide, styles.homeBlock)}>
        <p className={cn(styles.homeTitle, "chalk-soft")}>{messages.address.title}</p>
        <p className={cn(styles.homeText, "chalk-soft")}>{messages.address.help}</p>
      </div>
      <div className={cn(styles.fieldWide, styles.streetRow)}>
        {field("street", messages.address.street, { autoComplete: "address-line1" })}
        {field("unit", messages.address.unit, { optional: true, autoComplete: "address-line2", maxLength: 40 })}
      </div>
      {field("city", messages.address.city, { autoComplete: "address-level2" })}
      <div className={styles.field}>
        {field("zip", messages.address.zip, { autoComplete: "postal-code", inputMode: "numeric" })}
        {zipNote && !errors.zip && (
          <p id="field-zip-travel" className={cn(zipNote.blocking ? styles.fieldError : styles.optional, "chalk-soft")} aria-live="polite">
            {zipNote.text}
          </p>
        )}
      </div>
      <div className={cn(styles.field, styles.fieldWide)}>
        <label htmlFor="field-access" className={cn(styles.label, "chalk-soft")}>
          {messages.address.access}
          <span className={styles.optional}>{messages.optional}</span>
        </label>
        <textarea
          id="field-access"
          className={cn(styles.input, styles.textareaShort)}
          rows={2}
          maxLength={300}
          value={contact.access}
          onChange={(e) => onChange("access", e.target.value)}
          placeholder={messages.address.accessPlaceholder}
        />
      </div>
      <fieldset className={cn(styles.fieldset, styles.fieldWide, styles.babiesForm)}>
        <legend className={cn(styles.label, "chalk-soft")}>{babies.length > 1 ? messages.baby.many : messages.baby.one}</legend>
        <div className={styles.babiesGrid}>
          {babyCard(babies[0], 0)}
          <ExtraBabiesPicker bundle={bundle} count={babies.length} checking={checkingBabyCount} onChange={onBabyCountChange} messages={messages.extraBabies} />
          {babies.length > 1 && <div className={styles.extraBabiesGrid}>{babies.slice(1).map((baby, index) => babyCard(baby, index + 1))}</div>}
        </div>
        {site.contact.email && (
          <p id="field-babyAge-hint" className={cn(styles.optional, "chalk-soft")}>
            {olderNote[0]}<a href={`mailto:${site.contact.email}`} className={styles.inlineLink}>{site.contact.email}</a>{olderNote[1]}
          </p>
        )}
      </fieldset>
      <div className={cn(styles.field, styles.fieldWide)}>
        <label htmlFor="field-notes" className={cn(styles.label, "chalk-soft")}>
          {messages.notes.label}<span className={styles.optional}>{messages.optional}</span>
        </label>
        <textarea
          id="field-notes"
          className={cn(styles.input, styles.textarea)}
          rows={3}
          value={contact.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder={messages.notes.placeholder}
        />
      </div>
      <div className={cn(styles.field, styles.fieldWide)}>
        <p className={cn(styles.label, styles.flush, "chalk-soft")}>
          {setups > 1 ? messages.backdrops.titleMany : messages.backdrops.title}
        </p>
        <p className={cn(styles.optional, styles.flush, "chalk-soft")}>{setups > 1 ? fill(messages.backdrops.hintMany, { n: String(setups) }) : messages.backdrops.hint}</p>
        <BackdropPicker max={setups} value={backdrops} onChange={onBackdrops} label={setups > 1 ? messages.backdrops.titleMany : messages.backdrops.title} names={messages.backdrops.names} />
      </div>
      <fieldset className={cn(styles.fieldset, styles.field, styles.fieldWide)} aria-describedby="consents-hint">
        <legend className={cn(styles.label, "chalk-soft")}>
          {messages.consents.title}
          <span className={styles.optional}>{messages.optional}</span>
        </legend>
        {(["sms", "photos"] as const).map((key) => (
          <label key={key} className={cn(styles.consent, "chalk-soft")}>
            <input id={`field-consent-${key}`} type="checkbox" checked={consents[key]} onChange={(e) => onConsent(key, e.target.checked)} />
            <span>{messages.consents[key]}</span>
          </label>
        ))}
        <p id="consents-hint" className={cn(styles.optional, "chalk-soft")}>{messages.consents.hint}</p>
      </fieldset>
    </div>
  );
}

/* ---------------- review ---------------- */

interface ReviewRow {
  label: string;
  value: string;
  /** Step to jump to for editing; -1 hides the edit button. */
  step: number;
  photo?: import("@/config/portfolio").PortfolioPhoto;
  /** Change link to another page (e.g. back to the bundles). */
  href?: string;
}

function Review({ rows, onEdit, messages }: { rows: ReviewRow[]; onEdit: (step: number) => void; messages: typeof en.bookingFlow.review }) {
  return (
    <dl className={styles.review}>
      {rows.map((r) => (
        <div key={r.label} className={styles.reviewRow}>
          <dt className={cn(styles.reviewLabel, "chalk-soft")}>{r.label}</dt>
          <dd className={cn(styles.reviewValue, "chalk-soft")}>
            {r.photo ? (
              <span className={styles.reviewPhoto}>
                <InspirationThumb photo={r.photo} size={56} />
                {r.value}
              </span>
            ) : (
              r.value
            )}
          </dd>
          <dd className={styles.reviewEdit}>
            {r.href && (
              <Link href={r.href} className={cn(styles.linkButton, "chalk-soft")} aria-label={fill(messages.changeAria, { label: r.label.toLocaleLowerCase() })}>
                {messages.change}
              </Link>
            )}
            {r.step >= 0 && (
              <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => onEdit(r.step)} aria-label={fill(messages.editAria, { label: r.label.toLocaleLowerCase() })}>
                {messages.edit}
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- optional discount code (review step) ---------------- */

function DiscountField({ applied, onApply, onRemove, messages, offerLabel }: { applied: string | null; onApply: (code: string) => Promise<PriceQuote>; onRemove: () => Promise<void>; messages: typeof en.bookingFlow.review.discount; offerLabel: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "info" | "error"; text: string } | null>(null);
  const apply = async () => {
    if (!code.trim()) return setNote({ kind: "error", text: messages.empty });
    setBusy(true);
    setNote(null);
    try {
      const q = await onApply(code.trim());
      const pricingNote = q.note
        ? fill(q.pricingType === "discount" ? messages.codeBetter : messages.offerBest, { offer: offerLabel })
        : "";
      setNote(
        q.pricingType === "discount"
          ? { kind: "ok", text: fill(messages.applied, { code: q.discountCode ?? "", amount: formatMoney(q.discountCents), note: pricingNote }) }
          : { kind: "info", text: pricingNote || messages.best },
      );
    } catch (e) {
      const known = e instanceof Error
        ? (Object.entries(CODE_MESSAGES) as [keyof typeof CODE_MESSAGES, string][]).find(([, text]) => text === e.message)?.[0]
        : undefined;
      const text = known
        ? messages.errors[known]
        : e instanceof BookingApiError && e.code === "network"
          ? messages.network
          : e instanceof BookingApiError && e.code === "rate_limited"
            ? messages.rateLimited
            : messages.failed;
      setNote({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.discount}>
      <label htmlFor="discount-code" className={cn(styles.discountLabel, "chalk-soft")}>{messages.label} <span className={styles.optional}>{messages.optional}</span></label>
      {applied ? (
        <p className={cn(styles.discountApplied, "chalk-soft")}>
          {messages.appliedBefore}<b>{applied}</b>{messages.appliedAfter}{" "}
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={async () => { setCode(""); setNote(null); await onRemove(); }}>{messages.remove}</button>
        </p>
      ) : (
        <div className={styles.discountRow}>
          <input id="discount-code" className={styles.input} value={code} maxLength={24} autoCapitalize="characters" autoComplete="off" placeholder={messages.placeholder} onChange={(e) => { setCode(e.target.value); setNote(null); }} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void apply())} />
          <button type="button" className={styles.discountApply} onClick={apply} disabled={busy}>{busy ? messages.checking : messages.apply}</button>
        </div>
      )}
      {note && <p className={cn(note.kind === "error" ? styles.error : styles.discountNote, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
    </div>
  );
}
