"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { babyAgeOptions } from "@/config/booking";
import { useCatalog } from "@/components/providers/CatalogProvider";
import ChalkBox from "@/components/ui/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import SectionHeading from "@/components/layout/SectionHeading/SectionHeading";
import { localePath } from "@/i18n/path";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import { travelHint } from "@/lib/travel/format";
import type { TravelQuote } from "@/lib/travel/types";
import { cn } from "@/lib/cn";
import formStyles from "../flow/Booking.module.css";
import styles from "./Quick.module.css";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
type Field = "parentName" | "phone" | "email" | "zip" | "babyName" | "dueDate" | "bestTime" | "message";
const empty: Record<Field, string> = { parentName: "", phone: "", email: "", zip: "", babyName: "", dueDate: "", bestTime: "", message: "" };
const NOT_BORN = "Not born yet";

/** The first problem the browser can spot before sending (the server checks again). */
function firstProblem(v: Record<Field, string>): "name" | "phone" | "email" | "zip" | null {
  if (v.parentName.trim().length < 2) return "name";
  if (v.phone.replace(/\D/g, "").length < 10) return "phone";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return "email";
  if (!/^\d{5}$/.test(v.zip.trim())) return "zip";
  return null;
}
const FIELD_OF = { name: "parentName", phone: "phone", email: "email", zip: "zip" } as const;

/**
 * The quick form (/quick, owner Nov 13: "people sometimes don't want to go through the whole process"): a family sends
 * their name, phone, email and ZIP code (baby, bundle and best times optional) and the owners book it for them from
 * /admin → Quotes / Booking. Nothing here goes to Meta or analytics.
 */
export default function QuickForm({ locale, messages, bookingMessages }: { locale: AppLocale; messages: typeof en.quick; bookingMessages: typeof en.bookingFlow }) {
  const t = messages;
  const { bundles, today, depositFor } = useCatalog();
  const params = useSearchParams();
  const active = bundles.filter((b) => b.active !== false);
  const [bundleId, setBundleId] = useState(() => {
    const wanted = params.get("bundle");
    return wanted && active.some((b) => b.id === wanted) ? wanted : "";
  });
  const [values, setValues] = useState(empty);
  const [age, setAge] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [travel, setTravel] = useState<{ zip: string; quote: TravelQuote | null } | null>(null);
  const openedAt = useRef(0);
  const thanks = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  useEffect(() => {
    if (sent) thanks.current?.focus();
  }, [sent]);

  const set = (name: Field, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (error?.field === name) setError(null);
  };

  // their travel fee, as on the booking form (and a heads-up when the ZIP code is outside the area we travel to)
  const zip = values.zip.trim().slice(0, 5);
  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) return;
    const ctrl = new AbortController();
    fetch(`/api/booking/travel?zip=${zip}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { travel?: TravelQuote } | null) => setTravel({ zip, quote: j?.travel ?? null }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [zip]);
  const zipNote = travel?.zip === zip && travel.quote ? travelHint(travel.quote, bookingMessages.details.travel) : null;

  // the deposit of the bundle they like, or the one every bundle shares (the thank-you note mentions it)
  const deposits = [...new Set(active.map((b) => depositFor(b.id) ?? 0))];
  const depositCents = bundleId ? (depositFor(bundleId) ?? 0) : deposits.length === 1 ? deposits[0] : Math.max(0, ...deposits);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = firstProblem(values);
    if (problem) {
      setError({ text: t.errors[problem], field: FIELD_OF[problem] });
      document.getElementById(`quick-${FIELD_OF[problem]}`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentName: values.parentName,
          phone: values.phone,
          email: values.email,
          zip: values.zip.trim(),
          babyName: values.babyName,
          babyAge: age || undefined,
          dueDate: age === NOT_BORN ? values.dueDate : "",
          bundleId,
          bestTime: values.bestTime,
          message: values.message,
          locale,
          hp,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string; field?: string } | null;
        const field = j?.field && j.field in FIELD_OF ? FIELD_OF[j.field as keyof typeof FIELD_OF] : undefined;
        setError({ text: j?.error || t.errors.server, field });
        setBusy(false);
        return;
      }
      setSent(values.parentName.trim().split(/\s+/)[0] ?? "");
    } catch {
      setError({ text: t.errors.server });
      setBusy(false);
    }
  };

  const input = (name: Field, label: string, opts: { type?: string; autoComplete?: string; inputMode?: "tel" | "email" | "numeric"; required?: boolean; placeholder?: string; note?: React.ReactNode; maxLength?: number } = {}) => (
    <div className={formStyles.field}>
      <label htmlFor={`quick-${name}`} className={cn(formStyles.label, "chalk-soft")}>{label}</label>
      <input id={`quick-${name}`} className={formStyles.input} type={opts.type ?? "text"} autoComplete={opts.autoComplete} inputMode={opts.inputMode} required={opts.required}
        placeholder={opts.placeholder} maxLength={opts.maxLength} value={values[name]} onChange={(e) => set(name, e.target.value)}
        aria-invalid={error?.field === name || undefined} aria-describedby={opts.note ? `quick-${name}-note` : undefined} />
      {opts.note}
    </div>
  );

  if (sent !== null) {
    return (
      <section className={styles.section} aria-labelledby="quick-thanks">
        <div className={cn("container", styles.narrow)}>
          <ChalkBox className={styles.done} seed={91} wobble={2.4} strokeWidth={2.4}>
            <h1 id="quick-thanks" ref={thanks} tabIndex={-1} className={cn(styles.doneTitle, "chalk")}>{sent ? fill(t.thanksTitle, { name: sent }) : t.thanksTitle.replace(/,?\s*\{name\}/, "")}</h1>
            <p className={cn(styles.doneText, "chalk-soft")}>{depositCents > 0 ? fill(t.thanksText, { deposit: formatMoney(depositCents) }) : t.thanksTextNoDeposit}</p>
            <p className={cn(styles.doneOnline, "chalk-soft")}>
              {t.thanksOnline}{" "}
              <a href={localePath("/bundles", locale)} className={formStyles.inlineLink}>{t.thanksOnlineLink}</a>
            </p>
          </ChalkBox>
        </div>
      </section>
    );
  }

  const privacy = t.privacy;
  return (
    <section className={styles.section} aria-labelledby="quick-title">
      <div className={cn("container", styles.narrow)}>
        <SectionHeading id="quick-title" title={t.title} subtitle={t.subtitle} slot="book" level={1} />
        <ChalkBox className={styles.box} seed={90} wobble={2.4} strokeWidth={2.4}>
          <form className={styles.form} onSubmit={submit} noValidate>
            {/* Honeypot: hidden from people and screen readers. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="quick-leave-empty">{bookingMessages.details.honeypot}</label>
              <input id="quick-leave-empty" name="quick-leave-empty" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </div>

            <div className={formStyles.form}>
              {input("parentName", t.name, { autoComplete: "name", required: true, maxLength: 120 })}
              {input("phone", t.phone, { type: "tel", autoComplete: "tel", inputMode: "tel", required: true, maxLength: 40 })}
              {input("email", t.email, { type: "email", autoComplete: "email", inputMode: "email", required: true, maxLength: 254 })}
              {input("zip", t.zip, {
                autoComplete: "postal-code", inputMode: "numeric", required: true, maxLength: 5,
                note: zipNote && (
                  <p id="quick-zip-note" className={cn(zipNote.blocking ? formStyles.fieldError : formStyles.optional, "chalk-soft")} aria-live="polite">{zipNote.text}</p>
                ),
              })}
              {input("babyName", t.babyName, { autoComplete: "off", maxLength: 80 })}
              <div className={formStyles.field}>
                <label htmlFor="quick-age" className={cn(formStyles.label, "chalk-soft")}>{t.babyAge}</label>
                <select id="quick-age" className={formStyles.input} value={age} onChange={(e) => setAge(e.target.value)}>
                  <option value="">{bookingMessages.details.baby.chooseAge}</option>
                  {babyAgeOptions.map((a, i) => <option key={a} value={a}>{bookingMessages.details.baby.ageOptions[i]}</option>)}
                </select>
              </div>
              {age === NOT_BORN && (
                <div className={formStyles.field}>
                  <label htmlFor="quick-dueDate" className={cn(formStyles.label, "chalk-soft")}>{t.dueDate}</label>
                  <input id="quick-dueDate" className={cn(formStyles.input, styles.date)} type="date" min={today} value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
                </div>
              )}
            </div>

            {active.length > 0 && (
              <fieldset className={styles.group}>
                <legend className={cn(formStyles.label, "chalk-soft")}>{t.bundle}</legend>
                <div className={styles.chips}>
                  {active.map((b) => {
                    const o = activeOffer(b, today);
                    return (
                      <button key={b.id} type="button" className={cn(styles.chip, bundleId === b.id && styles.chipOn)} aria-pressed={bundleId === b.id} onClick={() => setBundleId(bundleId === b.id ? "" : b.id)}>
                        <span className={styles.chipName}>{b.name}</span>
                        <span className={styles.chipPrice}>{o ? <><s>{formatMoney(toCents(b.price))}</s> {formatMoney(o.cents)}</> : formatMoney(toCents(b.price))}</span>
                      </button>
                    );
                  })}
                  <button type="button" className={cn(styles.chip, !bundleId && styles.chipOn)} aria-pressed={!bundleId} onClick={() => setBundleId("")}>
                    <span className={styles.chipName}>{t.notSure}</span>
                  </button>
                </div>
              </fieldset>
            )}

            <div className={formStyles.form}>
              <div className={cn(formStyles.field, formStyles.fieldWide)}>
                <label htmlFor="quick-bestTime" className={cn(formStyles.label, "chalk-soft")}>{t.bestTime}</label>
                <input id="quick-bestTime" className={formStyles.input} placeholder={t.bestTimePlaceholder} maxLength={200} value={values.bestTime} onChange={(e) => set("bestTime", e.target.value)} />
              </div>
              <div className={cn(formStyles.field, formStyles.fieldWide)}>
                <label htmlFor="quick-message" className={cn(formStyles.label, "chalk-soft")}>{t.message}</label>
                <textarea id="quick-message" className={cn(formStyles.input, formStyles.textareaShort)} rows={2} maxLength={1000} value={values.message} onChange={(e) => set("message", e.target.value)} />
              </div>
            </div>

            {error && <p className={cn(formStyles.error, styles.error, "chalk-soft")} role="alert">{error.text}</p>}
            <p className={cn(formStyles.optional, "chalk-soft")}>
              {privacy}{" "}
              <a href={localePath("/privacy", locale)} className={formStyles.inlineLink} target="_blank" rel="noopener">{t.privacyLink}</a>
            </p>
            <ChalkButton type="submit" variant="solid" disabled={busy} seed={92} className={styles.submit}>
              {busy ? t.sending : t.send}
            </ChalkButton>
          </form>
        </ChalkBox>
      </div>
    </section>
  );
}
