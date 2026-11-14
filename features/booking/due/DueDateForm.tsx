"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { site } from "@/config/site";
import { useCatalog } from "@/components/providers/CatalogProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import BookingPaused from "@/features/booking/BookingPaused";
import { formatLongDate } from "@/lib/booking/dates";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import { travelHint } from "@/lib/travel/format";
import { isFloridaZip, type TravelQuote } from "@/lib/travel/types";
import { dueWindow, type DueCreateResult } from "@/lib/due-date/types";
import { looksLikeEmail, saveBookingDraft } from "@/lib/unfinished/client";
import { localePath } from "@/i18n/path";
import { setupsOf } from "@/config/backdrops";
import BackdropPicker from "@/features/booking/backdrops/BackdropPicker";
import { DiscountField } from "@/features/booking/flow/steps/ReviewStep";
import { HttpBookingClient } from "@/lib/booking/http-client";
import { forgetDueReturn, pendingDueReturn, rememberDueReturn } from "@/lib/due-date/return-path";
import { backdropName } from "@/lib/booking/backdrop-names";
import type { PriceQuote } from "@/lib/pricing/engine";
import formStyles from "../flow/Booking.module.css";
import styles from "./DueDate.module.css";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
type Field = "firstName" | "lastName" | "email" | "phone" | "street" | "unit" | "city" | "zip" | "notes";
/** How long the form has been open (a spam signal: people take longer than 4 seconds). */
const elapsedSince = (start: number) => Date.now() - start;
const fullName = (c: Record<Field, string>) => `${c.firstName.trim()} ${c.lastName.trim()}`.trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const empty: Record<Field, string> = { firstName: "", lastName: "", email: "", phone: "", street: "", unit: "", city: "", zip: "", notes: "" };

/**
 * "Not born yet?" (/due-date), four steps (owner, Nov 11; step one split Nov 13): 1) bundle, due date (today to 9
 * months ahead), first name, email and ZIP code; 2) last name, phone and home address ("Reserve my spot" checks them
 * on the server, so the travel fee and deposit come from the full address); 3) backdrops, or "Not sure yet" to skip;
 * 4) review with an optional discount code (it comes off the session; the deposit stays the same), then the deposit
 * on Stripe. Then "Your spot is reserved", and an email with the link to pick their session when the baby arrives.
 */
export default function DueDateForm({ locale, messages, bookingMessages, pausedMessages }: { locale: AppLocale; messages: typeof en.dueDate; bookingMessages: typeof en.bookingFlow; pausedMessages: typeof en.bundlesPage.paused }) {
  const t = messages.page;
  const { bundles, available, today, depositFor } = useCatalog();
  const params = useSearchParams();
  const router = useRouter();
  const [bundleId, setBundleId] = useState(() => params.get("bundle") ?? "");
  const [dueDate, setDueDate] = useState("");
  const [babyCount, setBabyCount] = useState(1);
  const [contact, setContact] = useState(empty);
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "redirecting" | null>(null);
  const [travel, setTravel] = useState<{ zip: string; quote: TravelQuote | null } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [code, setCode] = useState<{ applied: string; quote: PriceQuote } | null>(null);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const openedAt = useRef(0);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // Back from Stripe without paying (or /due-date opened again in this tab): their reservation page with "Pay the
  // deposit", not an empty form (owner, Nov 11). "Reserve again" links add ?new=1 to start over.
  useEffect(() => {
    if (params.get("new")) return forgetDueReturn();
    const resume = () => {
      const path = pendingDueReturn();
      if (path) router.replace(path);
    };
    resume();
    const onShow = (e: PageTransitionEvent) => e.persisted && resume();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [params, router]);

  // /admin → Unfinished bookings (owner, Nov 11): the parent's contact details, saved when they leave a contact box
  // (from step one: first name, email, ZIP code and the due date, owner Nov 13), labeled "Not born yet". Never the
  // babies or the notes. Same rules as the booking form.
  const savedEmail = useRef<string | null>(null);
  const lastDraft = useRef("");
  const saveDraft = () => {
    const email = contact.email.trim();
    if (!looksLikeEmail(email)) return;
    const zipCode = contact.zip.trim().slice(0, 5);
    const draft = {
      email,
      parentName: fullName(contact) || undefined,
      phone: contact.phone.trim() || undefined,
      bundleId: bundleId || "none",
      zip: /^\d{5}$/.test(zipCode) ? zipCode : undefined,
      date: dueDate && dueDate >= range.from && dueDate <= range.to ? dueDate : undefined,
      step: "details" as const,
      locale,
      form: "due_date" as const,
      replaces: savedEmail.current && savedEmail.current.toLowerCase() !== email.toLowerCase() ? savedEmail.current : undefined,
    };
    const key = JSON.stringify(draft);
    if (key === lastDraft.current) return;
    lastDraft.current = key;
    savedEmail.current = email;
    saveBookingDraft(draft);
  };
  const saveNote = bookingMessages.details.saveNote.split("{privacy}");

  const range = dueWindow(today);
  const last = formatLongDate(range.to, locale).replace(/^[^,]+, /, "");
  const bundle = bundles.find((b) => b.id === bundleId) ?? null;
  const maxBabies = bundle?.extraBaby?.active ? bundle.extraBaby.maxBabies : 1;
  const zip = contact.zip.trim().slice(0, 5);

  // the travel fee for their ZIP code, as on the booking form
  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) return;
    const ctrl = new AbortController();
    fetch(`/api/booking/travel?zip=${zip}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { travel?: TravelQuote } | null) => setTravel({ zip, quote: j?.travel ?? null }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [zip]);
  const travelQuote = travel?.zip === zip ? travel.quote : null;
  const zipNote = travelQuote ? travelHint(travelQuote, bookingMessages.details.travel) : null;

  const offer = bundle ? activeOffer(bundle, today) : null;
  const priceCents = bundle ? offer?.cents ?? toCents(bundle.price) : 0;
  const travelCents = travelQuote?.status === "fee" ? travelQuote.feeCents : 0;
  const depositCents = bundle ? Math.min(depositFor(bundle.id) ?? 0, priceCents + travelCents) : 0;
  const deposit = formatMoney(depositCents);

  const setups = bundle ? setupsOf([bundle.setups, ...bundle.features]) : 1;
  const codeCents = code?.quote.pricingType === "discount" ? code.quote.finalCents : null;
  const stepTop = useRef<HTMLParagraphElement>(null);
  const shownStep = useRef(step);
  // a new step: to its top, and its heading gets focus (screen readers hear where they are)
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    stepTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    stepTitle.current?.focus({ preventScroll: true });
  }, [step]);
  const go = (next: 1 | 2 | 3 | 4) => {
    setStep(next);
    setError(null);
  };
  const chooseBundle = (id: string) => {
    setBundleId(id);
    setError(null);
    // a code and backdrops belong to one bundle
    setCode(null);
    setBackdrops([]);
  };
  const payload = () => ({
    bundleId,
    locale,
    babyCount: Math.min(babyCount, maxBabies),
    dueDate,
    contact: { parentName: fullName(contact), email: contact.email.trim(), phone: contact.phone.trim(), notes: contact.notes.trim() || undefined },
    address: { street: contact.street.trim(), unit: contact.unit.trim() || undefined, city: contact.city.trim(), zip: contact.zip.trim() },
    hp: hp || undefined,
    elapsedMs: elapsedSince(openedAt.current),
  });

  const set = (field: Field, value: string) => {
    setContact((c) => ({ ...c, [field]: value }));
    setError(null);
  };
  const focusError = (field: Field, message: string) => {
    setError(message);
    requestAnimationFrame(() => document.getElementById(`due-${field}`)?.focus());
  };

  // the ZIP code box: 5 digits, in the area we travel to (asked now if the answer isn't on screen yet)
  const zipProblem = async (): Promise<string | null> => {
    const v = bookingMessages.details;
    if (!/^\d{5}$/.test(contact.zip.trim())) return v.validation.zip;
    if (!isFloridaZip(zip)) return v.travel.outsideFlorida;
    let quote = travel?.zip === zip ? travel.quote : null;
    if (travel?.zip !== zip) {
      quote = await fetch(`/api/booking/travel?zip=${zip}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { travel?: TravelQuote } | null) => j?.travel ?? null)
        .catch(() => null);
      setTravel({ zip, quote });
    }
    return quote && (quote.status === "too_far" || quote.status === "outside_florida") ? travelHint(quote, v.travel)?.text ?? null : null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!bundle) return setError(t.pickBundle);
    if (!dueDate || dueDate < range.from || dueDate > range.to) return setError(fill(t.pickDate, { last }));
    if (step === 1) {
      // first name, email and ZIP code (owner, Nov 13); the rest comes on the next step
      const v = bookingMessages.details.validation;
      if (!contact.firstName.trim()) return focusError("firstName", v.firstName);
      if (!EMAIL_RE.test(contact.email.trim())) return focusError("email", v.email);
      setBusy("saving");
      const problem = await zipProblem();
      setBusy(null);
      if (problem) return focusError("zip", problem);
      saveDraft();
      return go(2);
    }
    if (zipNote?.blocking) return setError(zipNote.text);
    if (step === 3) return go(4);
    setBusy("saving");
    setError(null);
    try {
      // step 2 only checks the details on the server (nothing is reserved yet)
      const res = await fetch("/api/due-date", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(step === 2 ? { ...payload(), check: true } : { ...payload(), backdrops, discountCode: code?.applied, requestId: (requestId.current ??= crypto.randomUUID()) }),
      });
      const body = (await res.json().catch(() => null)) as (DueCreateResult & { error?: string; checked?: boolean }) | null;
      if (!res.ok || !body) throw new Error(body?.error || messages.errors.server);
      if (step === 2) {
        setBusy(null);
        saveDraft();
        return go(3);
      }
      if (body.depositUrl) {
        setBusy("redirecting");
        if (body.donePath) rememberDueReturn(body.donePath);
        window.location.assign(body.depositUrl);
        return;
      }
      if (body.donePath) router.push(body.donePath);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : messages.errors.server);
      setBusy(null);
    }
  };

  const field = (name: Field, label: string, opts: { type?: string; autoComplete?: string; inputMode?: "tel" | "email" | "numeric"; optional?: boolean; wide?: boolean; note?: React.ReactNode } = {}) => (
    <div className={cn(formStyles.field, opts.wide && formStyles.fieldWide)}>
      <label htmlFor={`due-${name}`} className={cn(formStyles.label, "chalk-soft")}>{label}</label>
      <input id={`due-${name}`} className={formStyles.input} type={opts.type ?? "text"} autoComplete={opts.autoComplete} inputMode={opts.inputMode} value={contact[name]} onChange={(e) => set(name, e.target.value)} required={!opts.optional}
        aria-describedby={opts.note ? `due-${name}-note` : undefined}
        onBlur={name === "firstName" || name === "lastName" || name === "email" || name === "phone" || name === "zip" ? saveDraft : undefined} />
      {opts.note && <p id={`due-${name}-note`} className={cn(formStyles.optional, formStyles.fieldNote, "chalk-soft")}>{opts.note}</p>}
    </div>
  );

  return (
    <section className={styles.section} aria-labelledby="due-title">
      <div className="container">
        <SectionHeading id="due-title" title={t.title} subtitle={t.subtitle} slot="book" level={1} />
        {!available ? (
          <BookingPaused messages={pausedMessages} />
        ) : (
          <div className={styles.layout}>
            <ChalkBox className={styles.box} seed={81} wobble={2.4} strokeWidth={2.4}>
              <form className={styles.form} onSubmit={submit} noValidate>
                {/* Honeypot: hidden from people and screen readers. */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                  <label htmlFor="due-leave-empty">{bookingMessages.details.honeypot}</label>
                  <input id="due-leave-empty" name="due-leave-empty" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
                </div>

                <p ref={stepTop} className={cn(styles.stepOf, "chalk-soft")}>{fill(t.stepOf, { n: String(step), name: step === 1 ? t.stepDetails : step === 2 ? t.stepHome : step === 3 ? t.stepBackdrops : t.stepReview })}</p>
                {step === 1 && (
                <>
                <p className={cn(formStyles.optional, styles.firstStep, "chalk-soft")}>{t.firstStep}</p>
                <fieldset className={styles.group}>
                  <legend className={cn(styles.legend, "chalk")}>{t.bundle}</legend>
                  <div className={styles.bundles}>
                    {bundles.map((b) => {
                      const o = activeOffer(b, today);
                      return (
                        <label key={b.id} className={cn(styles.bundle, b.id === bundleId && styles.bundleOn)}>
                          <input type="radio" name="due-bundle" value={b.id} checked={b.id === bundleId} onChange={() => chooseBundle(b.id)} className={styles.radio} />
                          <span className={cn(styles.bundleName, "chalk")}>{b.name}</span>
                          <span className={cn(styles.bundlePrice, "chalk-soft")}>
                            {o ? <><s>{formatMoney(toCents(b.price))}</s> <b>{formatMoney(o.cents)}</b> · {o.label}</> : formatMoney(toCents(b.price))}
                            {b.duration ? ` · ${b.duration}` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className={cn(formStyles.form, styles.fields)}>
                  <div className={formStyles.field}>
                    <label htmlFor="due-date" className={cn(formStyles.label, "chalk-soft")}>{t.dueDate}</label>
                    <input id="due-date" className={cn(formStyles.input, styles.date)} type="date" min={range.from} max={range.to} value={dueDate} onChange={(e) => (setDueDate(e.target.value), setError(null))} required aria-describedby="due-date-hint" />
                    <p id="due-date-hint" className={cn(formStyles.optional, "chalk-soft")}>{fill(t.dueHint, { last })}</p>
                  </div>
                  {maxBabies > 1 && (
                    <div className={formStyles.field} role="group" aria-labelledby="due-babies">
                      <p id="due-babies" className={cn(formStyles.label, formStyles.flush, "chalk-soft")}>{t.babies}</p>
                      <div className={styles.chips}>
                        {[1, 2, 3].filter((n) => n <= maxBabies).map((n) => (
                          <button key={n} type="button" className={cn(styles.chip, babyCount === n && styles.chipOn)} aria-pressed={babyCount === n} onClick={() => setBabyCount(n)}>
                            {n === 1 ? t.one : n === 2 ? t.twins : t.triplets}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {field("firstName", bookingMessages.details.firstName, { autoComplete: "given-name" })}
                  {field("email", t.email, { type: "email", autoComplete: "email", inputMode: "email" })}
                  <div className={formStyles.field}>
                    {field("zip", bookingMessages.details.zipFirst, { autoComplete: "postal-code", inputMode: "numeric" })}
                    {zipNote && (
                      <p className={cn(zipNote.blocking ? formStyles.fieldError : formStyles.optional, "chalk-soft")} aria-live="polite">
                        {zipNote.text}
                      </p>
                    )}
                  </div>
                </div>
                {error && <p className={cn(formStyles.error, "chalk-soft")} role="alert">{error}</p>}
                {/* owner, Nov 11: at the bottom of the step, by the button, not under the email box (people hesitated there) */}
                <p id="due-save-note" className={cn(formStyles.optional, formStyles.fieldNote, "chalk-soft")}>
                  {saveNote[0]}
                  <a href={localePath("/privacy", locale)} className={formStyles.inlineLink} target="_blank" rel="noopener">{bookingMessages.details.saveNotePrivacy}</a>
                  {saveNote[1]}
                </p>
                <ChalkButton type="submit" variant="solid" disabled={busy !== null} seed={82} className={styles.submit}>
                  {busy ? t.checking : t.toHome}
                </ChalkButton>
                </>
                )}

                {step === 2 && bundle && (
                <div className={styles.stepBody}>
                  <h2 ref={stepTitle} tabIndex={-1} className={cn(styles.legend, "chalk")}>{t.stepHome}</h2>
                  <div className={cn(formStyles.form, styles.fields)}>
                  {field("firstName", bookingMessages.details.firstName, { autoComplete: "given-name" })}
                  {field("lastName", bookingMessages.details.lastName, { autoComplete: "family-name" })}
                  {field("phone", t.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
                  <p className={cn(formStyles.fieldWide, styles.subhead, "chalk")}>{t.address}</p>
                  <div className={cn(formStyles.fieldWide, formStyles.streetRow)}>
                    {field("street", t.street, { autoComplete: "address-line1" })}
                    {field("unit", t.unit, { autoComplete: "address-line2", optional: true })}
                  </div>
                  {field("city", t.city, { autoComplete: "address-level2" })}
                  <div className={formStyles.field}>
                    {field("zip", t.zip, { autoComplete: "postal-code", inputMode: "numeric" })}
                    {zipNote && (
                      <p className={cn(zipNote.blocking ? formStyles.fieldError : formStyles.optional, "chalk-soft")} aria-live="polite">
                        {zipNote.text}
                      </p>
                    )}
                  </div>
                  <div className={cn(formStyles.field, formStyles.fieldWide)}>
                    <label htmlFor="due-notes" className={cn(formStyles.label, "chalk-soft")}>{t.notes}</label>
                    <textarea id="due-notes" className={cn(formStyles.input, formStyles.textareaShort)} rows={2} maxLength={1500} value={contact.notes} onChange={(e) => set("notes", e.target.value)} />
                  </div>
                  </div>
                {bundle && (
                  <div className={cn(styles.summary, "chalk-soft")} aria-live="polite">
                    <p>{offer ? fill(t.priceOffer, { offer: offer.label, price: formatMoney(offer.cents), regular: formatMoney(toCents(bundle.price)) }) : fill(t.price, { price: formatMoney(priceCents) })}</p>
                    <p>{depositCents > 0 ? fill(t.depositNote, { deposit }) : t.noDepositNote}</p>
                  </div>
                )}
                {error && <p className={cn(formStyles.error, "chalk-soft")} role="alert">{error}</p>}
                {/* owner, Nov 11: at the bottom of the step, by the button, not under the email box (people hesitated there) */}
                <p id="due-save-note" className={cn(formStyles.optional, formStyles.fieldNote, "chalk-soft")}>
                  {saveNote[0]}
                  <a href={localePath("/privacy", locale)} className={formStyles.inlineLink} target="_blank" rel="noopener">{bookingMessages.details.saveNotePrivacy}</a>
                  {saveNote[1]}
                </p>
                  <div className={styles.stepActions}>
                    <button type="button" className={cn(formStyles.linkButton, "chalk-soft")} onClick={() => go(1)}>{t.back}</button>
                    <ChalkButton type="submit" variant="solid" disabled={busy !== null} seed={85} className={styles.submit}>
                      {busy ? t.checking : t.submit}
                    </ChalkButton>
                  </div>
                </div>
                )}

                {step === 3 && bundle && (
                  <div className={styles.stepBody}>
                    <h2 ref={stepTitle} tabIndex={-1} className={cn(styles.legend, "chalk")}>{setups > 1 ? bookingMessages.details.backdrops.titleMany : bookingMessages.details.backdrops.title}</h2>
                    <p className={cn(formStyles.optional, "chalk-soft")}>{setups > 1 ? fill(t.backdropsHintMany, { n: String(setups) }) : t.backdropsHint}</p>
                    <BackdropPicker max={setups} value={backdrops} onChange={setBackdrops} label={setups > 1 ? bookingMessages.details.backdrops.titleMany : bookingMessages.details.backdrops.title} names={bookingMessages.details.backdrops.names} />
                    {error && <p className={cn(formStyles.error, "chalk-soft")} role="alert">{error}</p>}
                    <div className={styles.stepActions}>
                      <button type="button" className={cn(formStyles.linkButton, "chalk-soft")} onClick={() => go(2)}>{t.back}</button>
                      <button type="button" className={cn(formStyles.linkButton, "chalk-soft")} onClick={() => (setBackdrops([]), go(4))}>{t.skipBackdrops}</button>
                      <ChalkButton type="submit" variant="solid" seed={83} className={styles.submit} disabled={!backdrops.length}>{t.toReview}</ChalkButton>
                    </div>
                  </div>
                )}

                {step === 4 && bundle && (
                  <div className={styles.stepBody}>
                    <h2 ref={stepTitle} tabIndex={-1} className={cn(styles.legend, "chalk")}>{t.reviewTitle}</h2>
                    <dl className={cn(styles.review, "chalk-soft")}>
                      <div><dt>{t.bundle}</dt><dd>{bundle.name}{babyCount > 1 ? ` · ${babyCount === 2 ? t.twins : t.triplets}` : ""}</dd></div>
                      <div><dt>{t.dueDate}</dt><dd>{formatLongDate(dueDate, locale)}</dd></div>
                      <div>
                        <dt>{t.reviewBackdrops}</dt>
                        <dd>
                          {backdrops.length ? backdrops.map((id) => backdropName(id, bookingMessages.details.backdrops.names)).join(", ") : t.noBackdrops}{" "}
                          <button type="button" className={cn(formStyles.linkButton, "chalk-soft")} onClick={() => go(3)}>{t.change}</button>
                        </dd>
                      </div>
                      <div>
                        <dt>{t.reviewPrice}</dt>
                        <dd>
                          {codeCents !== null && code
                            ? fill(t.codePrice, { price: formatMoney(codeCents), code: code.applied, regular: formatMoney(code.quote.regularCents) })
                            : offer ? fill(t.priceOffer, { offer: offer.label, price: formatMoney(offer.cents), regular: formatMoney(toCents(bundle.price)) }) : fill(t.price, { price: formatMoney(priceCents) })}
                        </dd>
                      </div>
                    </dl>
                    <DiscountField
                      applied={code?.applied ?? null}
                      offerLabel={offer?.label ?? ""}
                      messages={bookingMessages.review.discount}
                      onApply={async (raw) => {
                        const q = await new HttpBookingClient().quote(bundle.id, raw, contact.email.trim(), Math.min(babyCount, maxBabies));
                        setCode(q.pricingType === "discount" && q.discountCode ? { applied: q.discountCode, quote: q } : null);
                        return q;
                      }}
                      onRemove={async () => setCode(null)}
                    />
                    <p className={cn(formStyles.optional, "chalk-soft")}>{depositCents > 0 ? fill(t.codeHint, { deposit }) : t.codeHintNoDeposit}</p>
                    <div className={cn(styles.summary, "chalk-soft")}>
                      <p>{depositCents > 0 ? fill(t.depositNote, { deposit }) : t.noDepositNote}</p>
                    </div>
                    {error && <p className={cn(formStyles.error, "chalk-soft")} role="alert">{error}</p>}
                    <div className={styles.stepActions}>
                      <button type="button" className={cn(formStyles.linkButton, "chalk-soft")} onClick={() => go(3)}>{t.back}</button>
                      <ChalkButton type="submit" variant="solid" disabled={busy !== null} seed={84} className={styles.submit}>
                        {busy === "redirecting" ? t.redirecting : busy ? t.submitting : depositCents > 0 ? fill(t.submitDeposit, { deposit }) : t.submit}
                      </ChalkButton>
                    </div>
                  </div>
                )}
              </form>
            </ChalkBox>

            <aside className={styles.how} aria-labelledby="due-how">
              <h2 id="due-how" className={cn(styles.howTitle, "chalk")}>{t.how}</h2>
              <ol className={styles.steps}>
                {t.steps.map((step, i) => (
                  <li key={i} className="chalk-soft">
                    <ChalkDoodle grain={false} name={i === 0 ? "heart" : i === 1 ? "star" : "house"} size={24} color="var(--sun-yellow)" strokeWidth={3} />
                    <span>{fill(step, { phone: site.contact.phone })}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
