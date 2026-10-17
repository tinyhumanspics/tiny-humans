"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import { activeOffer, formatMoney, toCents, type PriceQuote } from "@/lib/pricing/engine";
import { bookingSettings, STEP } from "@/config/booking";
import { addDays, fromDateKey, getBookingClient, BookingApiError, startOfDay, toDateKey, type BookingResult, type DateKey, type TimeSlot } from "@/lib/booking";
import { isFloridaZip, type TravelQuote } from "@/lib/travel/types";
import { travelHint } from "@/lib/travel/format";
import { setupsOf } from "@/config/backdrops";
import { rememberDepositReturn } from "@/lib/booking/deposit-return";
import type { DepositOffer } from "@/lib/deposit/types";
import { INTRO_DONE_EVENT } from "@/components/layout/Reveal/Reveal";
import { consumeBookingScroll, scrollToBooking } from "@/lib/scroll/booking";
import { trackBeginBooking, trackBooked } from "@/lib/tracking/client";
import { extraBabyLine, type BookingBaby } from "@/lib/booking/extra-babies";
import { BOOKING_LANGUAGE_SWITCH_EVENT, consumeBookingLanguageDraft, saveBookingLanguageDraft } from "@/lib/booking/language-draft";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { useBookingSelection } from "./BookingSelectionContext";
import { apiErrorMessage, initialState, isLanguageDraftPayload, newRequestId, reducer, validateContact, type LanguageDraftPayload, type State } from "./booking-state";

/**
 * The booking form's state and actions: availability, travel estimate, deposit, discount quote, the language-switch
 * draft and the submit (same requestId on retries). `Booking` and the step components only render it.
 */
export function useBookingFlow(bundleId: string, locale: AppLocale, messages: typeof en.bookingFlow) {
  const provider = getBookingClient();
  // one id per submission: retries of the same booking can never double-book
  const requestIdRef = useRef<string | null>(null);
  // spam signals: when the booking box opened, and a hidden field only bots fill in
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
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

  // availability is per bundle and baby count: an answer for a count the family has since changed is dropped
  const availabilityFor = useRef("");
  const loadMonth = useCallback(
    async (m: Date, bundleId: string, babyCount: number) => {
      const key = `${bundleId}:${babyCount}`;
      availabilityFor.current = key;
      setLoadingDays(true);
      try {
        const from = toDateKey(new Date(m.getFullYear(), m.getMonth(), 1));
        const to = toDateKey(new Date(m.getFullYear(), m.getMonth() + 1, 0));
        const result = await provider.getAvailability({ bundleId, babyCount, from, to });
        if (availabilityFor.current !== key) return;
        setDays((prev) => {
          const next = { ...prev };
          result.forEach((d) => (next[d.date] = d.slots));
          return next;
        });
      } catch (err) {
        if (availabilityFor.current !== key) return;
        dispatch({
          type: "stepError",
          message: apiErrorMessage(err, messages, messages.errors.availability),
        });
      } finally {
        setLoadingDays(false);
      }
    },
    [messages, provider, dispatch, setDays],
  );

  useEffect(() => {
    if (state.step >= STEP.date && state.bundleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loads what is on screen (fine per react.dev)
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
  const restoredLanguageDraft = useRef(false);

  useEffect(() => {
    if (restoredLanguageDraft.current) return;
    restoredLanguageDraft.current = true;
    const draft = consumeBookingLanguageDraft<LanguageDraftPayload>(window.sessionStorage, window.location.pathname, bundleId);
    if (!isLanguageDraftPayload(draft, bundleId)) return;

    const restoredState: State = {
      ...draft.state,
      babies: draft.state.babies.map((baby) => ({ ...baby, gender: baby.gender ?? "" })),
      bundleId,
      status: "editing",
      result: null,
      stepError: null,
      fieldErrors: {},
      babyErrors: [],
    };
    const restoredMonth = new Date(`${draft.month}-01T12:00:00`);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      dispatch({ type: "restore", state: restoredState });
      setDays({}); // the restored baby count may differ: drop availability loaded for the old one
      setBackdrops(draft.backdrops.slice(0, setups));
      setAppliedCode(draft.appliedCode);
      setQuote(null);
      if (!Number.isNaN(restoredMonth.getTime())) setMonth(restoredMonth);
      openedAt.current = draft.openedAt;
      requestIdRef.current = draft.requestId;
    });
    return () => {
      active = false;
    };
  }, [bundleId, setups]);

  useEffect(() => {
    const saveBeforeSwitch = (event: Event) => {
      const targetPath = (event as CustomEvent<{ targetPath?: string }>).detail?.targetPath;
      if (!targetPath || state.status === "done") return;
      saveBookingLanguageDraft(window.sessionStorage, targetPath, bundleId, {
        state: {
          ...state,
          status: "editing",
          result: null,
          stepError: null,
          fieldErrors: {},
          babyErrors: [],
        },
        backdrops,
        month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
        appliedCode,
        openedAt: openedAt.current,
        requestId: requestIdRef.current,
      } satisfies LanguageDraftPayload);
    };
    window.addEventListener(BOOKING_LANGUAGE_SWITCH_EVENT, saveBeforeSwitch);
    return () => window.removeEventListener(BOOKING_LANGUAGE_SWITCH_EVENT, saveBeforeSwitch);
  }, [appliedCode, backdrops, bundleId, month, state]);

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
      dispatch({ type: "stepError", message: apiErrorMessage(err, messages, messages.details.extraBabies.checkFailed) });
    } finally {
      setCheckingBabyCount(false);
    }
  };
  // this bundle's deposit today (paid on Stripe as the last step); null = none
  const [depositOffer, setDepositOffer] = useState<DepositOffer | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
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
    provider
      .quote(state.bundleId, appliedCode ?? undefined, appliedCode ? state.contact.email.trim() || undefined : undefined, state.babies.length)
      .then(setQuote)
      .catch(() => {
        setQuote(null);
        if (appliedCode) setAppliedCode(null);
      });
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
      const babies: BookingBaby[] = state.babies.map((baby) => ({ name: baby.name.trim() || undefined, age: baby.age, gender: baby.gender || undefined }));
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
        dispatch({ type: "stepError", message: messages.errors.slotTaken });
        return;
      }
      dispatch({
        type: "submitFailed",
        message: apiErrorMessage(err, messages, messages.errors.submit),
      });
    }
  };

  const daySlots = state.date ? days[state.date] : undefined;

  return {
    state, dispatch, provider, router, selection, headingRef, panelRef,
    hp, setHp, days, loadingDays, studioToday, month, setMonth,
    inspiration, bundle, today, addon, quote, setQuote, zip, travel, travelChecking, travelFee,
    backdrops, setBackdrops, setups, appliedCode, setAppliedCode, checkingBabyCount, changeBabyCount,
    depositOffer, redirecting, bundleCents, beforeTravelCents, totalCents, depositCents, deposit,
    goTo, goBack, next, submit, daySlots,
  };
}

export type BookingFlow = ReturnType<typeof useBookingFlow>;
