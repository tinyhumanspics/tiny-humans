"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { site } from "@/config/site";
import { formatPrice, getBundle } from "@/config/bundles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import BabyLedNote from "./BabyLedNote";
import { babyAgeOptions, bookingSettings, bookingSteps, bundlesHref, homeSession, STEP } from "@/config/booking";
import {
  addDays,
  formatLongDate,
  formatTimeLabel,
  getBookingClient,
  BookingApiError,
  startOfDay,
  toDateKey,
  type BookingResult,
  type DateKey,
  type TimeSlot,
} from "@/lib/booking";
import SectionHeading from "@/components/SectionHeading/SectionHeading";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { useBookingSelection } from "./BookingSelectionContext";
import ChoiceCard from "./ChoiceCard";
import StepTracker from "./StepTracker";
import Calendar from "./Calendar";
import InspirationThumb from "./InspirationThumb";
import Reveal, { INTRO_DONE_EVENT } from "@/components/Reveal/Reveal";
import { consumeBookingScroll, scrollToBooking } from "@/lib/scroll/booking";
import styles from "./Booking.module.css";

/* ---------------- state ---------------- */

interface ContactDraft {
  parentName: string;
  email: string;
  phone: string;
  babyName: string;
  babyAge: string;
  notes: string;
  /** We bring the studio to the family's home. */
  street: string;
  city: string;
  zip: string;
}

type ContactErrors = Partial<Record<keyof ContactDraft, string>>;

interface State {
  step: number;
  maxStep: number;
  bundleId: string | null;
  date: DateKey | null;
  slot: TimeSlot | null;
  contact: ContactDraft;
  stepError: string | null;
  fieldErrors: ContactErrors;
  status: "editing" | "submitting" | "done";
  result: BookingResult | null;
}

const emptyContact: ContactDraft = { parentName: "", email: "", phone: "", babyName: "", babyAge: "", notes: "", street: "", city: "", zip: "" };

const initialState: State = {
  step: STEP.date,
  maxStep: STEP.date,
  bundleId: null,
  date: null,
  slot: null,
  contact: emptyContact,
  stepError: null,
  fieldErrors: {},
  status: "editing",
  result: null,
};

type Action =
  | { type: "date"; date: DateKey }
  | { type: "slot"; slot: TimeSlot }
  | { type: "contact"; field: keyof ContactDraft; value: string }
  | { type: "go"; step: number }
  | { type: "next" }
  | { type: "back" }
  | { type: "stepError"; message: string }
  | { type: "fieldErrors"; errors: ContactErrors }
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
    case "go":
      return action.step <= state.maxStep ? { ...state, step: action.step, stepError: null } : state;
    case "next": {
      const step = Math.min(state.step + 1, bookingSteps.length - 1);
      return { ...state, step, maxStep: Math.max(state.maxStep, step), stepError: null, fieldErrors: {} };
    }
    case "back":
      return { ...state, step: Math.max(0, state.step - 1), stepError: null };
    case "stepError":
      return { ...state, stepError: action.message };
    case "fieldErrors":
      return { ...state, fieldErrors: action.errors };
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

function validateContact(c: ContactDraft): ContactErrors {
  const e: ContactErrors = {};
  if (c.parentName.trim().length < 2) e.parentName = "Add the parent or guardian's name.";
  if (!EMAIL_RE.test(c.email.trim())) e.email = "Enter an email like name@example.com.";
  if (c.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a phone number with at least 10 digits.";
  if (!c.babyAge) e.babyAge = "Choose your baby's age.";
  if (c.street.trim().length < 4) e.street = "Add the street address where we'll set up.";
  if (c.city.trim().length < 2) e.city = "Add the city.";
  if (!/^\d{5}(-\d{4})?$/.test(c.zip.trim())) e.zip = "Enter a 5-digit ZIP code.";
  return e;
}

/* ---------------- component ---------------- */

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const stepTitles = ["Pick a day", "Pick a time", "Tell us about your family", "Check everything"];

/** The booking calendar for one bundle (chosen on the bundles page). */
export default function Booking({ bundleId }: { bundleId: string }) {
  const { id, title, subtitle } = site.sections.book;
  const provider = getBookingClient();
  // one id per submission: retries of the same booking can never double-book
  const requestIdRef = useRef<string | null>(null);
  const selection = useBookingSelection();
  const [state, dispatch] = useReducer(reducer, { ...initialState, bundleId });
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // availability cache for the current bundle
  const [days, setDays] = useState<Record<DateKey, TimeSlot[]>>({});
  const [loadingDays, setLoadingDays] = useState(false);
  const earliest = addDays(startOfDay(new Date()), bookingSettings.minDaysAhead);
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
  }, [state.bundleId]);

  const loadMonth = useCallback(
    async (m: Date, bundleId: string) => {
      setLoadingDays(true);
      try {
        const from = toDateKey(new Date(m.getFullYear(), m.getMonth(), 1));
        const to = toDateKey(new Date(m.getFullYear(), m.getMonth() + 1, 0));
        const result = await provider.getAvailability({ bundleId, from, to });
        setDays((prev) => {
          const next = { ...prev };
          result.forEach((d) => (next[d.date] = d.slots));
          return next;
        });
      } catch (err) {
        dispatch({
          type: "stepError",
          message: err instanceof BookingApiError ? err.message : "We couldn't load open times. Please try again.",
        });
      } finally {
        setLoadingDays(false);
      }
    },
    [provider],
  );

  useEffect(() => {
    if (state.step >= STEP.date && state.bundleId) {
      void loadMonth(month, state.bundleId);
    }
  }, [state.step, state.bundleId, month, loadMonth]);

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
  const bundle = getBundle(state.bundleId);

  const next = () => {
    switch (state.step) {
      case STEP.date:
        if (!state.date) return dispatch({ type: "stepError", message: "Pick a day on the calendar." });
        break;
      case STEP.time:
        if (!state.slot) return dispatch({ type: "stepError", message: "Pick a time to continue." });
        break;
      case STEP.details: {
        const errors = validateContact(state.contact);
        if (Object.keys(errors).length) {
          dispatch({ type: "fieldErrors", errors });
          const first = Object.keys(errors)[0];
          requestAnimationFrame(() => document.getElementById(`field-${first}`)?.focus());
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
      const result = await provider.createBooking({
        bundleId: state.bundleId,
        slot: state.slot,
        inspirationPhotoId: inspiration?.id,
        contact: {
          parentName: c.parentName.trim(),
          email: c.email.trim(),
          phone: c.phone.trim(),
          babyName: c.babyName.trim() || undefined,
          babyAge: c.babyAge,
          notes: c.notes.trim() || undefined,
        },
        address: { street: c.street.trim(), city: c.city.trim(), zip: c.zip.trim() },
        requestId: (requestIdRef.current ??= newRequestId()),
      });
      requestIdRef.current = null;
      dispatch({ type: "done", result });
    } catch (err) {
      if (err instanceof BookingApiError && err.code === "slot_unavailable" && state.slot) {
        // that time is gone: drop it and send the family back to pick another
        const taken = state.slot;
        requestIdRef.current = null;
        setDays((prev) => ({ ...prev, [taken.date]: (prev[taken.date] ?? []).filter((x) => x.id !== taken.id) }));
        dispatch({ type: "go", step: STEP.time });
        dispatch({ type: "stepError", message: err.message });
        return;
      }
      dispatch({
        type: "submitFailed",
        message: err instanceof BookingApiError ? err.message : "The booking couldn't be saved. Check your connection and press Book my session again.",
      });
    }
  };

  const daySlots = state.date ? days[state.date] : undefined;

  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className="container">
        <SectionHeading id={`${id}-title`} title={title} subtitle={subtitle} slot="book" />
        {state.status !== "done" && bundle && (
          <div className={styles.bundleSummary}>
            {inspiration && <InspirationThumb photo={inspiration} size={44} />}
            <div className={styles.summaryText}>
              <p className="chalk-soft">
                <span className={styles.chipLabel}>Your bundle</span>{" "}
                <span className={styles.bundleName}>{bundle.name}</span>
                <span className={styles.bundleMeta}>
                  {formatPrice(bundle.price)} · {bundle.duration} · {bundle.photos} edited photos
                </span>
              </p>
              {inspiration && (
                <p className={`${styles.summaryPhoto} chalk-soft`}>
                  <span className={styles.chipLabel}>Inspired by</span> {inspiration.title}{" "}
                  <button type="button" className={`${styles.inlineLink} chalk-soft`} onClick={() => selection.setInspirationId(null)} aria-label="Remove inspiration photo">
                    Remove
                  </button>
                </p>
              )}
            </div>
            <Link href={bundlesHref(selection.inspirationId)} className={`${styles.linkButton} chalk-soft`}>
              Change bundle
            </Link>
          </div>
        )}
        <BabyLedNote />

        <Reveal>
        <div ref={panelRef} className={styles.panelAnchor} data-booking-panel>
          <ChalkBox className={styles.panel} seed={7} wobble={4} strokeWidth={3}>
            {state.status === "done" && state.result ? (
              <Confirmation
                result={state.result}
                headingRef={headingRef}
                onReset={() => router.push("/book")}
              />
            ) : (
              <>
                <StepTracker current={state.step} maxReached={state.maxStep} onGo={(s) => dispatch({ type: "go", step: s })} />

                <div className={styles.stepBody}>
                  <h3 ref={headingRef} tabIndex={-1} className={`${styles.stepTitle} chalk`}>
                    {stepTitles[state.step]}
                  </h3>

                  {state.step === STEP.date && (
                    <Calendar
                      month={month}
                      onMonthChange={setMonth}
                      days={days}
                      loading={loadingDays}
                      selected={state.date}
                      onSelect={(d) => dispatch({ type: "date", date: d })}
                    />
                  )}

                  {state.step === STEP.time && state.date && (
                    <fieldset className={styles.fieldset}>
                      <legend className={`${styles.subtle} chalk-soft`}>{formatLongDate(state.date)}</legend>
                      {daySlots === undefined ? (
                        <p className={`${styles.subtle} chalk-soft`}>Checking open times…</p>
                      ) : daySlots.length === 0 ? (
                        <p className={`${styles.subtle} chalk-soft`}>This day just filled up. Go back and pick another day.</p>
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
                              title={slot.label}
                              detail={`until ${formatTimeLabel(slot.end)}`}
                            />
                          ))}
                        </div>
                      )}
                    </fieldset>
                  )}

                  {state.step === STEP.details && (
                    <DetailsForm contact={state.contact} errors={state.fieldErrors} onChange={(field, value) => dispatch({ type: "contact", field, value })} />
                  )}

                  {state.step === STEP.review && bundle && state.date && state.slot && (
                    <Review
                      rows={[
                        { label: "Package", value: bundle.name, step: -1, href: bundlesHref(selection.inspirationId) },
                        { label: "Price", value: formatPrice(bundle.price), step: -1 },
                        ...(inspiration ? [{ label: "Inspiration", value: inspiration.title, step: -1, photo: inspiration }] : []),
                        { label: "Date", value: formatLongDate(state.date), step: STEP.date },
                        { label: "Time", value: `${state.slot.label} to ${formatTimeLabel(state.slot.end)}`, step: STEP.time },
                        { label: "We'll come to", value: `${state.contact.street.trim()}, ${state.contact.city.trim()} ${state.contact.zip.trim()}`, step: STEP.details },
                        { label: "Parent / guardian", value: state.contact.parentName, step: STEP.details },
                        { label: "Email", value: state.contact.email, step: STEP.details },
                        { label: "Phone", value: state.contact.phone, step: STEP.details },
                        {
                          label: "Baby",
                          value: [state.contact.babyName.trim(), state.contact.babyAge].filter(Boolean).join(", "),
                          step: STEP.details,
                        },
                        ...(state.contact.notes.trim() ? [{ label: "Notes", value: state.contact.notes.trim(), step: STEP.details }] : []),
                      ]}
                      onEdit={(s) => dispatch({ type: "go", step: s })}
                    />
                  )}

                  {state.step === STEP.review && <BabyLedNote compact />}

                  {state.stepError && (
                    <p className={`${styles.error} chalk-soft`} role="alert">
                      {state.stepError}
                    </p>
                  )}
                </div>

                <div className={styles.actions}>
                  {state.step > 0 ? (
                    <ChalkButton variant="outline" onClick={() => dispatch({ type: "back" })} seed={81}>
                      Back
                    </ChalkButton>
                  ) : (
                    <span />
                  )}
                  {state.step < bookingSteps.length - 1 ? (
                    <ChalkButton variant="solid" onClick={next} seed={82}>
                      Next: {bookingSteps[state.step + 1].label}
                    </ChalkButton>
                  ) : (
                    <ChalkButton variant="solid" onClick={submit} disabled={state.status === "submitting"} seed={83}>
                      {state.status === "submitting" ? "Booking…" : "Book my session"}
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

/* ---------------- details form ---------------- */

function DetailsForm({
  contact,
  errors,
  onChange,
}: {
  contact: ContactDraft;
  errors: ContactErrors;
  onChange: (field: keyof ContactDraft, value: string) => void;
}) {
  const field = (
    name: keyof ContactDraft,
    label: string,
    opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" | "text" | "numeric" } = {},
  ) => {
    const errId = `field-${name}-error`;
    return (
      <div className={styles.field}>
        <label htmlFor={`field-${name}`} className={`${styles.label} chalk-soft`}>
          {label}
          {opts.optional && <span className={styles.optional}> (optional)</span>}
        </label>
        <input
          id={`field-${name}`}
          className={styles.input}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          value={contact[name]}
          onChange={(e) => onChange(name, e.target.value)}
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? errId : undefined}
          required={!opts.optional}
        />
        {errors[name] && (
          <p id={errId} className={`${styles.fieldError} chalk-soft`}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={styles.form}>
      {field("parentName", "Parent / guardian name", { autoComplete: "name" })}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      <div className={`${styles.fieldWide} ${styles.homeBlock}`}>
        <p className={`${styles.homeTitle} chalk-soft`}>Where should we bring the studio?</p>
        <p className={`${styles.homeText} chalk-soft`}>{homeSession.addressHelp}</p>
      </div>
      <div className={styles.fieldWide}>{field("street", "Street address", { autoComplete: "street-address" })}</div>
      {field("city", "City", { autoComplete: "address-level2" })}
      {field("zip", "ZIP code", { autoComplete: "postal-code", inputMode: "numeric" })}
      {field("babyName", "Baby's name", { optional: true, autoComplete: "off" })}
      <div className={styles.field}>
        <label htmlFor="field-babyAge" className={`${styles.label} chalk-soft`}>
          Baby&apos;s age
        </label>
        <select
          id="field-babyAge"
          className={styles.input}
          value={contact.babyAge}
          onChange={(e) => onChange("babyAge", e.target.value)}
          aria-invalid={Boolean(errors.babyAge)}
          aria-describedby={errors.babyAge ? "field-babyAge-error" : undefined}
          required
        >
          <option value="">Choose an age</option>
          {babyAgeOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {errors.babyAge && (
          <p id="field-babyAge-error" className={`${styles.fieldError} chalk-soft`}>
            {errors.babyAge}
          </p>
        )}
      </div>
      <div className={`${styles.field} ${styles.fieldWide}`}>
        <label htmlFor="field-notes" className={`${styles.label} chalk-soft`}>
          Notes or special requests<span className={styles.optional}> (optional)</span>
        </label>
        <textarea
          id="field-notes"
          className={`${styles.input} ${styles.textarea}`}
          rows={3}
          value={contact.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="Siblings joining, favorite colors, a family heirloom to include…"
        />
      </div>
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

function Review({ rows, onEdit }: { rows: ReviewRow[]; onEdit: (step: number) => void }) {
  return (
    <dl className={styles.review}>
      {rows.map((r) => (
        <div key={r.label} className={styles.reviewRow}>
          <dt className={`${styles.reviewLabel} chalk-soft`}>{r.label}</dt>
          <dd className={`${styles.reviewValue} chalk-soft`}>
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
              <Link href={r.href} className={`${styles.linkButton} chalk-soft`} aria-label={`Change ${r.label.toLowerCase()}`}>
                Change
              </Link>
            )}
            {r.step >= 0 && (
              <button type="button" className={`${styles.linkButton} chalk-soft`} onClick={() => onEdit(r.step)} aria-label={`Edit ${r.label.toLowerCase()}`}>
                Edit
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- confirmation ---------------- */

function Confirmation({
  result,
  headingRef,
  onReset,
}: {
  result: BookingResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
}) {
  const r = result.request;
  const bundle = getBundle(r.bundleId);
  const firstName = r.contact.parentName.split(" ")[0];
  const { photos } = useSiteSettings();
  const inspiration = findPhoto(photos, r.inspirationPhotoId);
  return (
    <div className={styles.confirm} role="status">
      <ChalkDoodle name="heart" size={84} color="var(--sun-yellow)" strokeWidth={3} className={styles.confirmHeart} />
      <h3 ref={headingRef} tabIndex={-1} className={`${styles.confirmTitle} chalk`}>
        See you soon, {firstName}!
      </h3>
      <p className={`${styles.confirmText} chalk-soft`}>
        Your {bundle?.name} session is penciled in for {formatLongDate(r.slot.date)} at {r.slot.label},{" "}
        at your home in {r.address.city}. We&apos;ll bring the whole studio to you.
        {r.contact.babyName ? ` We can't wait to meet ${r.contact.babyName}.` : ""}
      </p>
      {inspiration && (
        <div className={styles.chip}>
          <InspirationThumb photo={inspiration} size={52} />
          <p className="chalk-soft">
            <span className={styles.chipLabel}>Inspiration saved:</span> {inspiration.title}
          </p>
        </div>
      )}
      <ChalkBox className={styles.mockNote} seed={91} wobble={2} strokeWidth={2} color="var(--cloud-blue)" double={false}>
        <p className="chalk-soft">
          {result.status === "mock"
            ? `Prototype preview: no calendar event was created and no email was sent. Reference ${result.id}.`
            : result.emailSent
              ? `A confirmation email is on its way to ${r.contact.email}. Your booking reference is ${result.id}.`
              : `Your session is booked. Your booking reference is ${result.id}. We'll email your confirmation to ${r.contact.email} shortly.`}
        </p>
      </ChalkBox>
      <ChalkButton variant="outline" onClick={onReset} seed={92}>
        Book another session
      </ChalkButton>
    </div>
  );
}

