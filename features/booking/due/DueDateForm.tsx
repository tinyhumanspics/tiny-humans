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
import type { TravelQuote } from "@/lib/travel/types";
import { dueWindow, type DueCreateResult } from "@/lib/due-date/types";
import { looksLikeEmail, saveBookingDraft } from "@/lib/unfinished/client";
import { localePath } from "@/i18n/path";
import formStyles from "../flow/Booking.module.css";
import styles from "./DueDate.module.css";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
type Field = "parentName" | "email" | "phone" | "street" | "unit" | "city" | "zip" | "notes";
/** How long the form has been open (a spam signal: people take longer than 4 seconds). */
const elapsedSince = (start: number) => Date.now() - start;
const empty: Record<Field, string> = { parentName: "", email: "", phone: "", street: "", unit: "", city: "", zip: "", notes: "" };

/**
 * "Not born yet?" (/due-date): the family picks a bundle, their due date (today to 9 months ahead) and leaves their
 * contact details and home address. With deposits on they pay it on Stripe; then "Your spot is reserved", and an email
 * with the link to pick their session when the baby arrives.
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
  const openedAt = useRef(0);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // /admin → Unfinished bookings (owner, Nov 11): the parent's contact details, saved when they leave a contact box,
  // labeled "Not born yet". Never the due date, the babies or the notes. Same rules as the booking form.
  const savedEmail = useRef<string | null>(null);
  const lastDraft = useRef("");
  const saveDraft = () => {
    const email = contact.email.trim();
    if (!looksLikeEmail(email)) return;
    const zipCode = contact.zip.trim().slice(0, 5);
    const draft = {
      email,
      parentName: contact.parentName.trim() || undefined,
      phone: contact.phone.trim() || undefined,
      bundleId: bundleId || "none",
      zip: /^\d{5}$/.test(zipCode) ? zipCode : undefined,
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

  const set = (field: Field, value: string) => {
    setContact((c) => ({ ...c, [field]: value }));
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle) return setError(t.pickBundle);
    if (!dueDate || dueDate < range.from || dueDate > range.to) return setError(fill(t.pickDate, { last }));
    if (zipNote?.blocking) return setError(zipNote.text);
    setBusy("saving");
    setError(null);
    try {
      const res = await fetch("/api/due-date", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bundleId: bundle.id,
          locale,
          babyCount: Math.min(babyCount, maxBabies),
          dueDate,
          contact: { parentName: contact.parentName.trim(), email: contact.email.trim(), phone: contact.phone.trim(), notes: contact.notes.trim() || undefined },
          address: { street: contact.street.trim(), unit: contact.unit.trim() || undefined, city: contact.city.trim(), zip: contact.zip.trim() },
          requestId: (requestId.current ??= crypto.randomUUID()),
          hp: hp || undefined,
          elapsedMs: elapsedSince(openedAt.current),
        }),
      });
      const body = (await res.json().catch(() => null)) as (DueCreateResult & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || messages.errors.server);
      if (body.depositUrl) {
        setBusy("redirecting");
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
        onBlur={name === "parentName" || name === "email" || name === "phone" || name === "zip" ? saveDraft : undefined} />
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

                <fieldset className={styles.group}>
                  <legend className={cn(styles.legend, "chalk")}>{t.bundle}</legend>
                  <div className={styles.bundles}>
                    {bundles.map((b) => {
                      const o = activeOffer(b, today);
                      return (
                        <label key={b.id} className={cn(styles.bundle, b.id === bundleId && styles.bundleOn)}>
                          <input type="radio" name="due-bundle" value={b.id} checked={b.id === bundleId} onChange={() => (setBundleId(b.id), setError(null))} className={styles.radio} />
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
                  <p className={cn(formStyles.fieldWide, styles.subhead, "chalk")}>{t.you}</p>
                  {field("parentName", t.name, { autoComplete: "name" })}
                  {field("email", t.email, { type: "email", autoComplete: "email", inputMode: "email", note: <>{saveNote[0]}<a href={localePath("/privacy", locale)} className={formStyles.inlineLink} target="_blank" rel="noopener">{bookingMessages.details.saveNotePrivacy}</a>{saveNote[1]}</> })}
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
                <ChalkButton type="submit" variant="solid" disabled={busy !== null} seed={82} className={styles.submit}>
                  {busy === "redirecting" ? t.redirecting : busy ? t.submitting : depositCents > 0 ? fill(t.submitDeposit, { deposit }) : t.submit}
                </ChalkButton>
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
