"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { setupsOf } from "@/config/backdrops";
import { babyAgeOptions, familyRoles } from "@/config/booking";
import type { AdminApi, OwnerBookingResult } from "@/lib/admin/client";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { extraBabyLine, familyLimit } from "@/lib/booking/extra-babies";
import { asksFamily } from "@/lib/booking/family";
import type { DayAvailability } from "@/lib/booking/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/pricing/engine";
import en from "@/messages/en.json";
import styles from "./Admin.module.css";

const ROLES = en.bookingFlow.details.family.roles;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const miami = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * /admin → Quotes / Booking (owner, Nov 12: "a lot of moms text us for us to book it for them"): fill in what the family
 * told you, pick the day and time, and book it. With deposits on, their time is held 48 hours and they get a link to
 * pick their backdrops and pay the deposit (paid → Leads → Confirmed; not paid → Leads → Not paid). Same prices and
 * rules as the booking form, except the online minimum notice.
 */
export default function OwnerBookingForm({ api, zip: quotedZip = "", babies: quotedBabies = 1 }: { api: AdminApi; zip?: string; babies?: number }) {
  const { bundles } = useCatalog();
  const active = bundles.filter((b) => b.active !== false);
  const [bundleId, setBundleId] = useState(active[0]?.id ?? "");
  const bundle = active.find((b) => b.id === bundleId);
  const [babies, setBabies] = useState<{ age: string; name: string }[]>(() => Array.from({ length: Math.min(3, Math.max(1, quotedBabies)) }, () => ({ age: babyAgeOptions[0], name: "" })));
  const [family, setFamily] = useState<{ role: string; name: string }[]>([]);
  const [contact, setContact] = useState({ parentName: "", email: "", phone: "" });
  const [address, setAddress] = useState({ street: "", unit: "", city: "", zip: quotedZip, accessNotes: "" });
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [locale, setLocale] = useState<"en" | "es">("en");
  const [sendEmail, setSendEmail] = useState(true);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<OwnerBookingResult | null>(null);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const requestId = useRef(newId());

  const babyChoices = bundle ? [1, 2, 3].filter((n) => n === 1 || extraBabyLine(bundle, n)) : [1];
  const familyMax = bundle && asksFamily(bundle) ? familyLimit(bundle, babies.length) : 0;
  const zip = address.zip.trim();

  // open times for the chosen day (bundle, babies and ZIP decide the length and trip days); a picked time belongs to
  // the query it came from, so changing the day or bundle clears it by itself
  const query = bundleId && date && /^\d{5}$/.test(zip) ? `${bundleId}|${babies.length}|${zip}|${date}` : null;
  const [loaded, setLoaded] = useState<{ query: string; day?: DayAvailability; error?: string } | null>(null);
  const [picked, setPicked] = useState<{ query: string; start: string } | null>(null);
  const times = loaded?.query === query ? (loaded.day ?? null) : null;
  const timesError = loaded?.query === query ? (loaded.error ?? null) : null;
  const loadingTimes = Boolean(query) && loaded?.query !== query;
  const start = picked && picked.query === query ? picked.start : "";
  const setStart = (value: string) => setPicked(query && value ? { query, start: value } : null);

  useEffect(() => {
    if (!query) return;
    let live = true;
    api
      .ownerSlots({ bundle: bundleId, babies: babies.length, zip, from: date, to: date })
      .then((days) => live && setLoaded({ query, day: days.find((d) => d.date === date) ?? { date, slots: [] } }))
      .catch((e) => live && setLoaded({ query, error: errText(e, "Couldn't load the times.") }));
    return () => {
      live = false;
    };
  }, [api, query, bundleId, babies.length, date, zip]);

  const setBabyCount = (n: number) => setBabies((list) => Array.from({ length: n }, (_, i) => list[i] ?? { age: list[0]?.age ?? babyAgeOptions[0], name: "" }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!bundle) return setError("Pick a bundle.");
    if (!date || !start) return setError("Pick the day and the time.");
    setBusy(true);
    try {
      const result = await api.ownerBook({
        bundleId,
        locale,
        babies: babies.map((b) => ({ age: b.age, ...(b.name.trim() ? { name: b.name.trim() } : {}) })),
        family: family.filter((m) => m.role).map((m) => ({ role: m.role, ...(m.name.trim() ? { name: m.name.trim() } : {}) })),
        slot: { date, start },
        contact: { ...contact, babyAge: babies[0].age, ...(babies[0].name.trim() ? { babyName: babies[0].name.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) },
        address: { street: address.street, city: address.city, zip: address.zip, ...(address.unit.trim() ? { unit: address.unit.trim() } : {}), ...(address.accessNotes.trim() ? { accessNotes: address.accessNotes.trim() } : {}) },
        ...(code.trim() ? { discountCode: code.trim() } : {}),
        requestId: requestId.current,
        email: sendEmail,
      });
      setDone(result);
    } catch (err) {
      setError(errText(err, "Couldn't book it. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: "link" | "text") => {
    const value = what === "link" ? done?.url : done?.sms;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setError("Couldn't copy. Select it and copy it yourself.");
    }
  };

  const again = () => {
    setDone(null);
    setCopied(null);
    setStart("");
    setDate("");
    setContact({ parentName: "", email: "", phone: "" });
    setAddress({ street: "", unit: "", city: "", zip: quotedZip, accessNotes: "" });
    setNotes("");
    setCode("");
    setFamily([]);
    setBabies([{ age: babyAgeOptions[0], name: "" }]);
    requestId.current = newId();
  };

  if (done) {
    const total = done.pricing ? done.pricing.totalCents + (done.travel?.feeCents ?? 0) : null;
    return (
      <section className={styles.section} aria-labelledby="owner-book-title">
        <h2 id="owner-book-title" className={cn(styles.h2, "chalk")}>Book it for them</h2>
        <div className={styles.availBlock} role="status">
          <h3 className={cn(styles.h3, "chalk")}>{`✓ Booked ${done.reference}`}</h3>
          {done.status === "pending" ? (
            <>
              <p className={cn(styles.banner, "chalk-soft")}>
                {`Their time is held until ${done.holdUntil ? miami(done.holdUntil) : "48 hours from now"} (Miami time). `}
                {done.emailed ? "We emailed them the link." : done.emailError ? `The email wasn't sent: ${done.emailError}` : "No email was sent: copy the link or the text and send it."}
              </p>
              <p className={cn(styles.muted, "chalk-soft")}>
                The link opens their page: they pick their {bundle && setupsOf([bundle.setups, ...bundle.features]) > 1 ? "backdrops" : "backdrop"} and pay the deposit. Paid → Leads → Confirmed (calendar event and confirmation email, as usual). Not paid in 48 hours → the time is released and they stay in Leads → Not paid.
              </p>
              {total !== null && <p className={cn(styles.hintSmall, "chalk-soft")}>{`Total ${formatMoney(total)}${done.travel?.feeCents ? ` (travel ${formatMoney(done.travel.feeCents)} included)` : ""}.`}</p>}
              <div className={styles.editorActions}>
                <ChalkButton variant="solid" onClick={() => copy("link")} seed={971}>{copied === "link" ? "Link copied ✓" : "Copy their link"}</ChalkButton>
                <ChalkButton variant="outline" onClick={() => copy("text")} seed={972}>{copied === "text" ? "Text copied ✓" : "Copy a text message"}</ChalkButton>
              </div>
            </>
          ) : (
            <p className={cn(styles.banner, "chalk-soft")}>Deposits are off, so the session is confirmed: it&apos;s on the calendar and they got the confirmation email.</p>
          )}
          <p className={cn(styles.hintSmall, "chalk-soft")}>
            <Link href="/admin/leads">Open Leads</Link> · <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={again}>Book another family</button>
          </p>
          {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="owner-book-title">
      <h2 id="owner-book-title" className={cn(styles.h2, "chalk")}>Book it for them</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        For moms who text you to book: fill in what they told you and pick the day and time. They get an email with a link to pick their backdrop and pay the
        deposit; their time is held for 48 hours. Paid → Leads → Confirmed. Not paid → Leads → Not paid.
      </p>
      <form onSubmit={submit} noValidate className={styles.ownerBookForm}>
        <fieldset className={styles.ownerBookGroup}>
          <legend className={cn(styles.h3, "chalk")}>The session</legend>
          <label className={cn(styles.label, "chalk-soft")}>
            Bundle
            <select className={styles.input} value={bundleId} onChange={(e) => (setBundleId(e.target.value), setFamily([]), setBabyCount(1))}>
              {active.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          {babyChoices.length > 1 && (
            <label className={cn(styles.label, "chalk-soft")}>
              Babies
              <select className={styles.input} value={babies.length} onChange={(e) => setBabyCount(Number(e.target.value))}>
                {babyChoices.map((n) => (
                  <option key={n} value={n}>{n === 1 ? "1 baby" : n === 2 ? "Twins" : "Triplets"}</option>
                ))}
              </select>
            </label>
          )}
          {babies.map((b, i) => (
            <div key={i} className={styles.ownerBookRow}>
              <label className={cn(styles.label, "chalk-soft")}>
                {babies.length > 1 ? `Baby ${i + 1}: age` : "Baby's age"}
                <select className={styles.input} value={b.age} onChange={(e) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))}>
                  {babyAgeOptions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className={cn(styles.label, "chalk-soft")}>
                {babies.length > 1 ? `Baby ${i + 1}: name (optional)` : "Baby's name (optional)"}
                <input className={styles.input} value={b.name} maxLength={80} onChange={(e) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </label>
            </div>
          ))}
          {familyMax > 0 && (
            <div className={styles.ownerBookFamily}>
              <p className={cn(styles.label, "chalk-soft")}>Who else is in the photos (optional)</p>
              {family.map((m, i) => (
                <div key={i} className={styles.ownerBookRow}>
                  <label className={cn(styles.label, "chalk-soft")}>
                    {`Person ${i + 1}`}
                    <select className={styles.input} value={m.role} onChange={(e) => setFamily((l) => l.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                      {familyRoles.map((r) => (
                        <option key={r} value={r}>{ROLES[r]}</option>
                      ))}
                    </select>
                  </label>
                  <label className={cn(styles.label, "chalk-soft")}>
                    {`Person ${i + 1}: name (optional)`}
                    <input className={styles.input} value={m.name} maxLength={60} onChange={(e) => setFamily((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  </label>
                  <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setFamily((l) => l.filter((_, j) => j !== i))}>
                    Remove<span className={styles.visuallyHidden}>{` person ${i + 1}`}</span>
                  </button>
                </div>
              ))}
              {family.length < familyMax && (
                <button type="button" className={styles.smallButton} onClick={() => setFamily((l) => [...l, { role: "mom", name: "" }])}>
                  + Add someone
                </button>
              )}
            </div>
          )}
          <div className={styles.ownerBookRow}>
            <label className={cn(styles.label, "chalk-soft")}>
              Day
              <input className={cn(styles.input, styles.timeInput)} type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Their ZIP code
              <input className={cn(styles.input, styles.timeInput)} inputMode="numeric" maxLength={5} value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value.replace(/\D/g, "").slice(0, 5) }))} />
            </label>
          </div>
          <div role="group" aria-label="Time" aria-busy={loadingTimes} className={styles.ownerBookTimes}>
            {!date || !/^\d{5}$/.test(zip) ? (
              <p className={cn(styles.hintSmall, "chalk-soft")}>Pick the day and add their ZIP code to see the open times.</p>
            ) : loadingTimes ? (
              <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Checking the calendar…</p>
            ) : timesError ? (
              <p className={cn(styles.error, "chalk-soft")} role="alert">{timesError}</p>
            ) : times && times.slots.length ? (
              times.slots.map((s) => (
                <button key={s.start} type="button" className={cn(styles.smallButton, start === s.start && styles.smallButtonOn)} aria-pressed={start === s.start} onClick={() => setStart(s.start)}>
                  {formatTimeLabel(s.start)}
                </button>
              ))
            ) : (
              <p className={cn(styles.hintSmall, "chalk-soft")}>{`No open times on ${formatLongDate(date)} for this bundle. Try another day.`}</p>
            )}
          </div>
        </fieldset>

        <fieldset className={styles.ownerBookGroup}>
          <legend className={cn(styles.h3, "chalk")}>The family</legend>
          <div className={styles.ownerBookRow}>
            <label className={cn(styles.label, "chalk-soft")}>
              Full name
              <input className={styles.input} value={contact.parentName} maxLength={120} autoComplete="off" onChange={(e) => setContact((c) => ({ ...c, parentName: e.target.value }))} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Email (their link goes here)
              <input className={styles.input} type="email" value={contact.email} maxLength={254} autoComplete="off" onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Phone
              <input className={styles.input} type="tel" value={contact.phone} maxLength={40} autoComplete="off" onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            </label>
          </div>
          <div className={styles.ownerBookRow}>
            <label className={cn(styles.label, "chalk-soft")}>
              Street address
              <input className={styles.input} value={address.street} maxLength={200} autoComplete="off" onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Apt / unit (optional)
              <input className={styles.input} value={address.unit} maxLength={40} autoComplete="off" onChange={(e) => setAddress((a) => ({ ...a, unit: e.target.value }))} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              City
              <input className={styles.input} value={address.city} maxLength={100} autoComplete="off" onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
            </label>
          </div>
          <label className={cn(styles.label, "chalk-soft")}>
            Gate code / parking (optional)
            <input className={styles.input} value={address.accessNotes} maxLength={300} autoComplete="off" onChange={(e) => setAddress((a) => ({ ...a, accessNotes: e.target.value }))} />
          </label>
          <label className={cn(styles.label, "chalk-soft")}>
            What they asked for (optional)
            <textarea className={styles.input} rows={3} value={notes} maxLength={1500} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </fieldset>

        <fieldset className={styles.ownerBookGroup}>
          <legend className={cn(styles.h3, "chalk")}>Price and email</legend>
          <div className={styles.ownerBookRow}>
            <label className={cn(styles.label, "chalk-soft")}>
              Discount code (optional)
              <input className={styles.input} value={code} maxLength={40} autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Their language (email and page)
              <select className={styles.input} value={locale} onChange={(e) => setLocale(e.target.value === "es" ? "es" : "en")}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </label>
          </div>
          <label className={cn(styles.ownerBookCheck, "chalk-soft")}>
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Email them the link now (you can also copy it and text it)
          </label>
        </fieldset>
        <p className={cn(styles.hintSmall, "chalk-soft")}>Same prices as the website today (special offers included). Their own permissions (texts, photos on the website) stay off; the photo waiver at the session covers the photos.</p>
        <ChalkButton type="submit" variant="solid" disabled={busy} seed={973}>{busy ? "Booking…" : "Book it and send the link"}</ChalkButton>
        {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      </form>
    </section>
  );
}
