"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/providers/CatalogProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import BookingPaused from "@/features/booking/BookingPaused";
import { bookingSettings } from "@/config/booking";
import { site } from "@/config/site";
import type { AppLocale } from "@/i18n/config";
import { addDays, formatLongDate, formatTimeLabel, fromDateKey, startOfDay, toDateKey, type DateKey, type TimeSlot } from "@/lib/booking";
import { HttpBookingClient } from "@/lib/booking/http-client";
import { cn } from "@/lib/cn";
import { dueWindow, type DueSummary } from "@/lib/due-date/types";
import { activeOffer, formatMoney } from "@/lib/pricing/engine";
import type { Bundle } from "@/lib/pricing/types";
import type { RequestSent, RequestType } from "@/lib/requests/types";
import { usMobile } from "@/lib/requests/types";
import { travelHint } from "@/lib/travel/format";
import type { TravelQuote } from "@/lib/travel/types";
import { trackLead } from "@/lib/tracking/client";
import { countBookingStep, looksLikeEmail } from "@/lib/unfinished/client";
import type en from "@/messages/en.json";
import { useBookingSelection } from "../flow/BookingSelectionContext";
import Calendar from "../flow/Calendar";
import TimeStep from "../flow/steps/TimeStep";
import flowStyles from "../flow/Booking.module.css";
import styles from "./RequestFlow.module.css";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
/** How long the form has been open (the server refuses requests faster than a person). */
const elapsedSince = (t: number | null) => (t === null ? undefined : Date.now() - t);
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

type Step = "when" | "details" | "sent";
type Field = "firstName" | "mobile" | "email" | "zip";

export interface RequestFlowMessages {
  request: typeof en.bookingRequest;
  calendar: typeof en.bookingFlow.calendar;
  time: typeof en.bookingFlow.time;
  travel: typeof en.bookingFlow.details.travel;
  paused: typeof en.bundlesPage.paused;
  due: typeof en.bookingFlow.due;
}

const priceOf = (b: Bundle, today: string) => activeOffer(b, today)?.cents ?? Math.round(b.price * 100);

/**
 * The new /book (brief 02): 1) When ("Baby is here" → day + start time, or "Not born yet" → due date; bundle and twins)
 * 2) Your details (first name, mobile, email, ZIP; "Send request") 3) Request sent. Nothing is paid here.
 * `due`: opened from a due-date reservation's schedule link (/book?due=…): its bundle, babies and kept price, their
 * details filled in, a day and start time only; the owner confirms it like any request (no new deposit).
 */
export default function RequestFlow({ locale, messages, freeMiles, noticeHours, due }: { locale: AppLocale; messages: RequestFlowMessages; freeMiles: number | null; noticeHours: number; due?: { token: string; summary: DueSummary } }) {
  const m = messages.request;
  const params = useSearchParams();
  const { bundles, getBundle, today, available, depositFor } = useCatalog();
  const { inspirationId } = useBookingSelection();
  const provider = useMemo(() => new HttpBookingClient(), []);

  const [bundleId, setBundleId] = useState<string | null>(() => (due ? due.summary.bundleId : (getBundle(params.get("bundle"))?.id ?? null)));
  const bundle = getBundle(bundleId);
  const [choosing, setChoosing] = useState(!bundle);
  const [type, setType] = useState<RequestType>("date");
  const [babyCount, setBabyCount] = useState(due?.summary.babyCount ?? 1);
  const [step, setStep] = useState<Step>("when");

  // screen 1: open days and start times (other families' held requests are already left out by the server)
  const earliest = addDays(startOfDay(fromDateKey(today)), bookingSettings.minDaysAhead);
  const [month, setMonth] = useState(() => new Date(earliest.getFullYear(), earliest.getMonth(), 1));
  // open times per bundle + baby count ("choice") and which months of it are loaded: nothing to reset on a change
  const choice = `${bundleId}:${babyCount}`;
  const monthKey = `${choice}:${month.getFullYear()}-${month.getMonth()}`;
  const [daysBy, setDaysBy] = useState<Record<string, Record<DateKey, TimeSlot[]>>>({});
  const [loaded, setLoaded] = useState<Record<string, number>>({});
  const [reload, setReload] = useState(0);
  const days = daysBy[choice] ?? {};
  const loadingDays = type === "date" && Boolean(bundleId) && loaded[monthKey] !== reload;
  const [date, setDate] = useState<DateKey | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [dueDate, setDueDate] = useState("");
  const dueRange = dueWindow(today);

  // screen 2
  const [fields, setFields] = useState<Record<Field, string>>(() => {
    const c = due?.summary.contact;
    return c ? { firstName: c.parentName.split(" ")[0], mobile: c.phone, email: c.email, zip: c.zip } : { firstName: "", mobile: "", email: "", zip: "" };
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  // the travel answer for the ZIP it was asked for (a ZIP changed since shows nothing)
  const [travelFor, setTravelFor] = useState<{ zip: string; quote: TravelQuote | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<RequestSent | null>(null);
  const openedAt = useRef<number | null>(null);
  const clientId = useRef(newId());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // the month on screen, for this bundle and baby count (an answer for an older choice is still kept under its own key)
  useEffect(() => {
    if (type !== "date" || step !== "when" || !bundleId) return;
    let live = true;
    const from = toDateKey(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    provider
      .getAvailability({ bundleId, babyCount, from, to })
      .then((result) => setDaysBy((prev) => ({ ...prev, [choice]: { ...prev[choice], ...Object.fromEntries(result.map((d) => [d.date, d.slots])) } })))
      .catch(() => live && setError(m.details.errors.generic))
      .finally(() => setLoaded((prev) => ({ ...prev, [monthKey]: reload })));
    return () => {
      live = false;
    };
  }, [type, step, bundleId, babyCount, month, choice, monthKey, reload, provider, m.details.errors.generic]);

  // anonymous step counts (no names, no ids): opened, picked when, saw the details screen; "sent" is counted on the server
  const counted = useRef(new Set<string>());
  const count = useCallback(
    (s: "when_viewed" | "when_done" | "details_viewed") => {
      if (!bundleId || counted.current.has(s)) return;
      counted.current.add(s);
      countBookingStep(s, bundleId);
    },
    [bundleId],
  );
  useEffect(() => count("when_viewed"), [count]);

  // each new screen: its title gets the focus (screen readers, keyboard) and the panel comes into view
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // the travel line under the ZIP box, once it's 5 digits
  const zip = fields.zip.trim();
  const travel = travelFor && travelFor.zip === zip ? travelFor.quote : null;
  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/booking/travel?zip=${zip}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { travel?: TravelQuote } | null) => live && setTravelFor({ zip, quote: j?.travel ?? null }))
        .catch(() => live && setTravelFor({ zip, quote: null }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [zip]);

  if (!available) return <BookingPaused messages={messages.paused} />;

  const extra = bundle?.extraBaby?.active && bundle.extraBaby.maxBabies >= 2 ? bundle.extraBaby : null;
  // a due-date reservation paid its deposit already: nothing more to hold the date
  const deposit = bundle && !due ? depositFor(bundle.id) : null;
  const depositText = deposit ? formatMoney(deposit) : null;
  const bundleCents = due ? due.summary.bundlePriceCents : bundle ? priceOf(bundle, today) : 0;
  const priceCents = bundle ? bundleCents + (babyCount > 1 && extra ? Math.round(extra.price * 100) * (babyCount - 1) : 0) : 0;
  const hint = travel ? travelHint(travel, messages.travel) : null;
  const whenLabel = type === "date" && date && slot ? `${formatLongDate(date, locale)} · ${formatTimeLabel(slot.start, locale)}` : type === "due_date" && dueDate ? fill(m.details.due, { date: formatLongDate(dueDate, locale) }) : "";
  const summary = bundle ? [whenLabel, bundle.name, formatMoney(priceCents + (travel?.status === "fee" ? travel.feeCents : 0))].filter(Boolean).join(" · ") : "";

  const goWhenNext = () => {
    setError(null);
    if (!bundle) return setError(m.when.pickBundle);
    if (type === "date" && !slot) return setError(m.when.pickTime);
    if (type === "due_date" && (!dueDate || dueDate < dueRange.from || dueDate > dueRange.to)) return setError(dueDate ? fill(m.when.dueWindow, { date: formatLongDate(dueRange.to, locale) }) : m.when.pickDue);
    count("when_done");
    count("details_viewed");
    setStep("details");
  };

  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!fields.firstName.trim()) e.firstName = m.details.errors.firstName;
    if (!usMobile(fields.mobile)) e.mobile = m.details.errors.mobile;
    if (!looksLikeEmail(fields.email.trim())) e.email = m.details.errors.email;
    if (!/^\d{5}$/.test(fields.zip.trim())) e.zip = m.details.errors.zip;
    return e;
  };

  const send = async () => {
    setError(null);
    const e = validate();
    setErrors(e);
    const first = (Object.keys(e) as Field[])[0];
    if (first) return document.getElementById(`request-${first}`)?.focus();
    if (hint?.blocking) return setError(hint.text);
    if (!bundle) return;
    setSending(true);
    try {
      const res = await fetch("/api/booking/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.current,
          locale,
          type,
          bundleId: bundle.id,
          babyCount,
          ...(type === "date" && date && slot ? { slot: { date, start: slot.start } } : { dueDate }),
          firstName: fields.firstName.trim(),
          mobile: fields.mobile.trim(),
          email: fields.email.trim(),
          zip: fields.zip.trim(),
          textConsent: consent,
          ...(due ? { dueToken: due.token } : {}),
          ...(inspirationId ? { inspiration: inspirationId } : {}),
          hp,
          elapsedMs: elapsedSince(openedAt.current),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { request?: RequestSent; lead?: boolean; error?: string; code?: string };
      if (res.ok && j.request) {
        // Meta Lead (the server sent the same one; one per person per 30 days, so only when the server says so)
        if (j.lead) trackLead({ eventId: j.request.reference, bundleId: bundle.id, firstName: fields.firstName, email: fields.email, mobile: fields.mobile, zip: fields.zip });
        setSent(j.request);
        setStep("sent");
        return;
      }
      // this submission was answered: the next one is a new request
      clientId.current = newId();
      if (j.code === "slot_unavailable") {
        // back to the times (what they typed stays), with that month's times fresh
        setSlot(null);
        setReload((n) => n + 1);
        setStep("when");
        setError(j.error ?? m.details.errors.slotTaken);
        return;
      }
      setError(j.error ?? m.details.errors.generic);
    } catch {
      // no answer: the same clientId on the next try, so a request that did arrive isn't sent twice
      setError(m.details.errors.generic);
    } finally {
      setSending(false);
    }
  };

  const field = (name: Field, label: string, opts: { type: string; autoComplete: string; inputMode?: "tel" | "email" | "numeric" | "text"; maxLength: number }) => (
    <div className={flowStyles.field}>
      <label htmlFor={`request-${name}`} className={cn(flowStyles.label, "chalk-soft")}>
        {label}
      </label>
      <input
        id={`request-${name}`}
        name={name}
        className={flowStyles.input}
        type={opts.type}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete}
        maxLength={opts.maxLength}
        value={fields[name]}
        onChange={(ev) => {
          const value = ev.target.value;
          setFields((f) => ({ ...f, [name]: value }));
          if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
        }}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `request-${name}-error` : undefined}
        required
      />
      {errors[name] && (
        <p id={`request-${name}-error`} className={cn(flowStyles.fieldError, "chalk-soft")}>
          {errors[name]}
        </p>
      )}
    </div>
  );

  const bundleRow = (
    <div className={styles.bundleRow}>
      {bundle && !choosing ? (
        <p className={cn(styles.bundleLine, "chalk-soft")}>
          <span className={flowStyles.chipLabel}>{m.when.bundle}</span> <span className={flowStyles.bundleName}>{bundle.name}</span> · {formatMoney(priceOf(bundle, today))} ·{" "}
          <button type="button" className={cn(flowStyles.inlineLink, "chalk-soft")} onClick={() => setChoosing(true)} aria-expanded={false}>
            {m.when.change}
          </button>
        </p>
      ) : (
        <fieldset className={flowStyles.fieldset}>
          <legend className={cn(flowStyles.subtle, "chalk-soft")}>{m.when.chooseBundle}</legend>
          <div className={styles.bundleList}>
            {bundles.map((b) => (
              <button
                key={b.id}
                type="button"
                className={cn(styles.bundleChoice, "chalk-soft", b.id === bundleId && styles.bundleChoiceOn)}
                aria-pressed={b.id === bundleId}
                onClick={() => {
                  setBundleId(b.id);
                  setSlot(null);
                  setChoosing(false);
                  setError(null);
                  if (!(b.extraBaby?.active && b.extraBaby.maxBabies >= 2)) setBabyCount(1);
                }}
              >
                <span className={styles.bundleChoiceName}>{b.name}</span> <span>{formatMoney(priceOf(b, today))}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );

  return (
    <section className={flowStyles.section} aria-labelledby="request-title">
      <div className="container">
        <div ref={panelRef} className={flowStyles.panelAnchor}>
          <ChalkBox className={flowStyles.panel} seed={7} wobble={4} strokeWidth={3}>
            {step === "sent" && sent ? (
              <div className={flowStyles.stepBody}>
                <h1 id="request-title" ref={headingRef} tabIndex={-1} className={cn(flowStyles.stepTitle, "chalk")}>
                  {fill(m.sent.title, { name: sent.firstName })}
                </h1>
                <p className={cn(styles.lead, "chalk-soft")}>
                  {fill(m.sent.textYou, {
                    mobile: sent.mobile,
                    when: sent.type === "due_date" && sent.dueDate ? fill(m.sent.whenDue, { date: formatLongDate(sent.dueDate, locale) }) : sent.slot ? `${formatLongDate(sent.slot.date, locale)}, ${formatTimeLabel(sent.slot.start, locale)}` : "",
                  })}
                </p>
                <p className={cn(styles.nextTitle, "chalk")}>{m.sent.next}</p>
                <ol className={cn(styles.nextSteps, "chalk-soft")}>
                  {(depositText ? m.sent.steps.map((s) => fill(s, { deposit: depositText })) : m.sent.stepsPlain).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className={cn(styles.question, "chalk-soft")}>
                  {m.sent.question.split("{phone}")[0]}
                  <a href={`sms:${site.contact.sms}`} className={flowStyles.inlineLink}>
                    {site.contact.phone}
                  </a>
                  {m.sent.question.split("{phone}")[1]}
                </p>
              </div>
            ) : step === "when" ? (
              <>
                <div className={flowStyles.stepBody}>
                  <h1 id="request-title" ref={headingRef} tabIndex={-1} className={cn(flowStyles.stepTitle, "chalk")}>
                    {m.when.title}
                  </h1>
                  {due && bundle ? (
                    <div className={cn(styles.dueNote, "chalk-soft")}>
                      <p className={styles.bundleChoiceName}>{messages.due.title}</p>
                      <p>{fill(messages.due.body, { bundle: bundle.name, price: formatMoney(priceCents) })}</p>
                      {due.summary.depositPaidCents > 0 && <p>{fill(messages.due.deposit, { deposit: formatMoney(due.summary.depositPaidCents) })}</p>}
                    </div>
                  ) : (
                    <>
                      <div className={styles.toggle} role="group" aria-label={m.when.title}>
                        {(["date", "due_date"] as const).map((t) => (
                          <button key={t} type="button" className={cn(styles.toggleButton, "chalk-soft", type === t && styles.toggleOn)} aria-pressed={type === t} onClick={() => (setType(t), setError(null))}>
                            {t === "date" ? m.when.here : m.when.notBorn}
                          </button>
                        ))}
                      </div>
                      <p className={cn(flowStyles.stepIntro, "chalk-soft")}>{type === "date" ? m.when.hereHelp : m.when.notBornHelp}</p>
                      {bundleRow}
                    </>
                  )}

                  {bundle && extra && !due && (
                    <label className={cn(styles.twins, "chalk-soft")}>
                      <input type="checkbox" checked={babyCount === 2} onChange={(ev) => (setBabyCount(ev.target.checked ? 2 : 1), setSlot(null))} /> {fill(m.when.twins, { price: formatMoney(Math.round(extra.price * 100)) })}
                    </label>
                  )}

                  {bundle && type === "date" && (
                    <>
                      <Calendar todayKey={today} month={month} onMonthChange={setMonth} days={days} loading={loadingDays} selected={date} onSelect={(d) => (setDate(d), setSlot(null), setError(null))} messages={messages.calendar} locale={locale} />
                      {date && <TimeStep date={date} slots={days[date]} selectedId={slot?.id} onSelect={(s) => (setSlot(s), setError(null))} locale={locale} messages={messages.time} />}
                    </>
                  )}

                  {bundle && type === "due_date" && (
                    <div className={flowStyles.field}>
                      <label htmlFor="request-due" className={cn(flowStyles.label, "chalk-soft")}>
                        {m.when.dueLabel}
                      </label>
                      <input id="request-due" className={flowStyles.input} type="date" min={dueRange.from} max={dueRange.to} value={dueDate} onChange={(ev) => (setDueDate(ev.target.value), setError(null))} />
                    </div>
                  )}

                  {freeMiles !== null && <p className={cn(styles.travelNote, "chalk-soft")}>{fill(m.when.travel, { miles: String(freeMiles) })}</p>}

                  {error && (
                    <p className={cn(flowStyles.error, "chalk-soft")} role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className={flowStyles.actions}>
                  <span />
                  <ChalkButton variant="solid" onClick={goWhenNext} seed={82}>
                    {m.when.next}
                  </ChalkButton>
                </div>
              </>
            ) : (
              <>
                <div className={flowStyles.stepBody}>
                  <h1 id="request-title" ref={headingRef} tabIndex={-1} className={cn(flowStyles.stepTitle, "chalk")}>
                    {m.details.title}
                  </h1>
                  <p className={cn(styles.summary, "chalk-soft")}>{summary}</p>
                  <div className={styles.fields}>
                    {field("firstName", m.details.firstName, { type: "text", autoComplete: "given-name", maxLength: 60 })}
                    {field("mobile", m.details.mobile, { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 30 })}
                    {field("email", m.details.email, { type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 })}
                    {field("zip", m.details.zip, { type: "text", autoComplete: "postal-code", inputMode: "numeric", maxLength: 5 })}
                  </div>
                  {hint && <p className={cn(hint.blocking ? flowStyles.error : styles.travelNote, "chalk-soft")}>{hint.text}</p>}
                  {/* never seen by people: a filled box marks a robot */}
                  <div className={styles.hp} aria-hidden="true">
                    <input id="request-hp" name="th-leave-empty" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(ev) => setHp(ev.target.value)} />
                  </div>
                  <label className={cn(styles.consent, "chalk-soft")}>
                    <input type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} /> {m.details.consent}
                  </label>
                  {error && (
                    <p className={cn(flowStyles.error, "chalk-soft")} role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className={flowStyles.actions}>
                  <ChalkButton variant="outline" onClick={() => (setStep("when"), setError(null))} seed={81}>
                    {m.details.back}
                  </ChalkButton>
                  <ChalkButton variant="solid" onClick={send} disabled={sending} seed={83}>
                    {sending ? m.details.sending : m.details.send}
                  </ChalkButton>
                </div>
                <div className={cn(styles.underButton, "chalk-soft")}>
                  <p>{depositText ? fill(m.details.nothingToPay, { deposit: depositText }) : m.details.nothingToPayPlain}</p>
                  {depositText && <p>{type === "due_date" ? fill(m.details.dueLine, { deposit: depositText }) : fill(m.details.holdLine, { deposit: depositText, hours: String(noticeHours) })}</p>}
                </div>
              </>
            )}
          </ChalkBox>
        </div>
      </div>
    </section>
  );
}
