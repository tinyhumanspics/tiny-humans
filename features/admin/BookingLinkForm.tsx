"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { babyAgeOptions, isOwnerSource, OWNER_SOURCES } from "@/config/booking";
import BookingCalendar from "@/features/booking/BookingCalendar";
import type { AdminApi } from "@/lib/admin/client";
import type { BookingLinkMade } from "@/lib/booking-links/types";
import { formatLongDate, formatTimeLabel, fromDateKey, toDateKey } from "@/lib/booking/dates";
import { HttpBookingClient } from "@/lib/booking/http-client";
import type { TimeSlot } from "@/lib/booking/types";
import { cn } from "@/lib/cn";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import type { Bundle } from "@/lib/pricing/types";
import en from "@/messages/en.json";
import styles from "./Admin.module.css";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
/** "Our Little Story · $269.10 (Thanksgiving Offer, was $299)": the price a family books at today. */
const bundleLabel = (b: Bundle, todayKey: string) => {
  const offer = activeOffer(b, todayKey);
  const regular = formatMoney(toCents(b.price));
  return offer ? `${b.name} · ${formatMoney(offer.cents)} (${offer.label}, was ${regular})` : `${b.name} · ${regular}`;
};
const monthStart = (key: string) => {
  const d = fromDateKey(key);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
/** Boy or girl is asked every time (owner, Nov 19); "unsure" = they don't know yet (saved as nothing). */
type GenderPick = "" | "boy" | "girl" | "unsure";
const GENDER_LABEL: Record<Exclude<GenderPick, "">, string> = { boy: "Boy", girl: "Girl", unsure: "Not sure yet" };
const NO_BABY = { age: babyAgeOptions[0] as string, name: "", gender: "" as GenderPick };

/**
 * /admin → Quotes / Booking → "Send a booking link" (owner, Nov 19: "I just send them the booking page with the bundle
 * already selected"): the session a family agreed with you (bundle, babies, ZIP, day, optional time) becomes a link.
 * Their booking page opens filled in; they add their name, phone and email and send it, and it shows up in Requests
 * ("From your link") to confirm as usual. The calendar is the booking page's own, so the day you pick is one they can
 * book.
 */
export default function BookingLinkForm({ api }: { api: AdminApi }) {
  const { bundles } = useCatalog();
  const active = bundles.filter((b) => b.active !== false);
  const [bundleId, setBundleId] = useState(() => active[0]?.id ?? "");
  const bundle = active.find((b) => b.id === bundleId);
  const [babies, setBabies] = useState<{ age: string; name: string; gender: GenderPick }[]>([NO_BABY]);
  const [zip, setZip] = useState("");
  const [locale, setLocale] = useState<"en" | "es">("en");
  // how they reached you (Leads → Source; brief 03): picked every time
  const [source, setSource] = useState("");
  const todayKey = today();
  const [date, setDate] = useState("");
  const [month, setMonth] = useState(() => monthStart(todayKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<(BookingLinkMade & { summary: string }) | null>(null);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);
  const booking = useMemo(() => new HttpBookingClient(), []);

  const maxBabies = bundle?.extraBaby?.active ? Math.min(3, Math.max(1, bundle.extraBaby.maxBabies)) : 1;
  const zipOk = /^\d{5}$/.test(zip);

  // the booking page's calendar for this bundle, babies and home (trip days included)
  const monthKey = toDateKey(month).slice(0, 7);
  const calQuery = bundleId && zipOk ? `${bundleId}|${babies.length}|${zip}|${monthKey}` : null;
  const [cal, setCal] = useState<{ query: string; days?: Record<string, TimeSlot[]>; error?: string } | null>(null);
  const days = cal?.query === calQuery ? (cal.days ?? {}) : {};
  const calError = cal?.query === calQuery ? (cal.error ?? null) : null;
  const calLoading = Boolean(calQuery) && cal?.query !== calQuery;
  const times = date && cal?.query === calQuery && cal.days ? (days[date] ?? []) : null;
  // a picked time belongs to its day and calendar: changing either clears it by itself
  const timeKey = calQuery && date ? `${calQuery}|${date}` : null;
  const [picked, setPicked] = useState<{ key: string; start: string } | null>(null);
  const start = picked && picked.key === timeKey ? picked.start : "";

  useEffect(() => {
    if (!calQuery) return;
    let live = true;
    const first = `${monthKey}-01`;
    const last = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    booking
      .getAvailability({ bundleId, babyCount: babies.length, from: first < todayKey ? todayKey : first, to: last, zip })
      .then((list) => live && setCal({ query: calQuery, days: Object.fromEntries(list.filter((d) => d.slots.length).map((d) => [d.date, d.slots])) }))
      .catch((e) => live && setCal({ query: calQuery, error: errText(e, "Couldn't load the calendar.") }));
    return () => {
      live = false;
    };
  }, [booking, calQuery, bundleId, babies.length, zip, monthKey, month, todayKey]);

  const setBabyCount = (n: number) => setBabies((list) => Array.from({ length: n }, (_, i) => list[i] ?? { age: list[0]?.age ?? NO_BABY.age, name: "", gender: "" }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!bundle) return setError("Pick a bundle.");
    if (!zipOk) return setError("Add their 5-digit ZIP code.");
    if (!date) return setError("Pick the day.");
    if (babies.some((b) => !b.gender)) return setError(babies.length > 1 ? "Pick boy or girl for each baby (or Not sure yet)." : "Pick boy or girl (or Not sure yet).");
    if (!isOwnerSource(source)) return setError("Pick how they reached you.");
    setBusy(true);
    try {
      const made = await api.makeBookingLink({
        bundleId,
        babies: babies.map((b) => ({ age: b.age as (typeof babyAgeOptions)[number], ...(b.name.trim() ? { name: b.name.trim() } : {}), ...(b.gender === "boy" || b.gender === "girl" ? { gender: b.gender } : {}) })),
        zip,
        date,
        ...(start ? { start } : {}),
        locale,
        source,
      });
      const who = babies.map((b) => [b.name.trim(), b.gender === "boy" || b.gender === "girl" ? GENDER_LABEL[b.gender] : "", b.age].filter(Boolean).join(", ")).join(" · ");
      setDone({ ...made, summary: [bundle.name, who, formatLongDate(date), start ? formatTimeLabel(start) : "they pick the time", `ZIP ${zip}`].join(" · ") });
    } catch (err) {
      setError(errText(err, "Couldn't make the link. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: "link" | "text") => {
    const value = what === "link" ? done?.url : done?.text;
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
    setError(null);
    setSource("");
    setDate("");
    setPicked(null);
    setZip("");
    setBabies([NO_BABY]);
  };

  if (done) {
    return (
      <section className={styles.section} aria-labelledby="booking-link-title">
        <h2 id="booking-link-title" className={cn(styles.h2, "chalk")}>Send a booking link</h2>
        <div className={styles.availBlock} role="status">
          <h3 className={cn(styles.h3, "chalk")}>✓ Their link is ready</h3>
          <p className={cn(styles.banner, "chalk-soft")}>{done.summary}</p>
          <label className={cn(styles.label, "chalk-soft")}>
            Their link
            <input className={styles.input} readOnly value={done.url} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className={styles.editorActions}>
            <ChalkButton variant="solid" onClick={() => copy("link")} seed={971}>{copied === "link" ? "Link copied ✓" : "Copy their link"}</ChalkButton>
            <ChalkButton variant="outline" onClick={() => copy("text")} seed={972}>{copied === "text" ? "Text copied ✓" : "Copy a text message"}</ChalkButton>
          </div>
          <p className={cn(styles.muted, "chalk-soft")}>
            Their page opens with all of this filled in: they add their name, phone and email and send it. It shows up in Requests as &ldquo;From your link&rdquo;: confirm it there and they get the pay link (deposit, then home address, ages and backdrop). The link works once, until that day.
          </p>
          <p className={cn(styles.hintSmall, "chalk-soft")}>
            <Link href="/admin/requests">Open Requests</Link> · <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={again}>Make another link</button>
          </p>
          {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="booking-link-title">
      <h2 id="booking-link-title" className={cn(styles.h2, "chalk")}>Send a booking link</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        For families who message you: fill in the session they told you about and send them the link. Their booking page opens with it filled in; they only add their name, phone and email.
      </p>
      <form onSubmit={submit} noValidate className={styles.ownerBookForm}>
        <fieldset className={styles.ownerBookGroup}>
          <legend className={cn(styles.h3, "chalk")}>The session</legend>
          <label className={cn(styles.label, "chalk-soft")}>
            Bundle
            <select className={styles.input} value={bundleId} onChange={(e) => (setBundleId(e.target.value), setBabyCount(1))}>
              {active.map((b) => (
                <option key={b.id} value={b.id}>{bundleLabel(b, todayKey)}</option>
              ))}
            </select>
          </label>
          {maxBabies > 1 && (
            <label className={cn(styles.label, "chalk-soft")}>
              Babies
              <select className={styles.input} value={babies.length} onChange={(e) => setBabyCount(Number(e.target.value))}>
                {[1, 2, 3].filter((n) => n <= maxBabies).map((n) => (
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
              <label className={cn(styles.label, "chalk-soft")}>
                {babies.length > 1 ? `Baby ${i + 1}: boy or girl` : "Boy or girl"}
                <select className={styles.input} value={b.gender} onChange={(e) => setBabies((l) => l.map((x, j) => (j === i ? { ...x, gender: e.target.value as GenderPick } : x)))}>
                  <option value="">Choose…</option>
                  {(["boy", "girl", "unsure"] as const).map((g) => (
                    <option key={g} value={g}>{GENDER_LABEL[g]}</option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <label className={cn(styles.label, styles.ownerBookZip, "chalk-soft")}>
            Their ZIP code
            <input className={cn(styles.input, styles.timeInput)} inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </label>
          {!calQuery ? (
            <p className={cn(styles.hintSmall, "chalk-soft")}>Add their ZIP code to see the calendar: the same open days and times their booking page shows.</p>
          ) : (
            <div className={styles.ownerBookCalendar}>
              <BookingCalendar todayKey={todayKey} month={month} onMonthChange={setMonth} days={days} loading={calLoading} selected={date || null} onSelect={setDate} messages={en.bookingFlow.calendar} locale="en" />
              {calError && <p className={cn(styles.error, "chalk-soft")} role="alert">{calError}</p>}
            </div>
          )}
          {calQuery && (
            <div role="group" aria-label="Time (optional)" className={styles.ownerBookTimes}>
              {!date ? (
                <p className={cn(styles.hintSmall, "chalk-soft")}>Pick the day they want.</p>
              ) : times && times.length ? (
                <>
                  <p className={cn(styles.ownerBookDay, "chalk-soft")}>{`${formatLongDate(date)}: pick the time too, or leave it for them`}</p>
                  {times.map((s) => (
                    <button key={s.start} type="button" className={cn(styles.smallButton, start === s.start && styles.smallButtonOn)} aria-pressed={start === s.start} onClick={() => setPicked(start === s.start || !timeKey ? null : { key: timeKey, start: s.start })}>
                      {formatTimeLabel(s.start)}
                    </button>
                  ))}
                </>
              ) : times ? (
                <p className={cn(styles.hintSmall, "chalk-soft")}>{`No open times on ${formatLongDate(date)} for this bundle. Pick another day.`}</p>
              ) : (
                <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Checking the calendar…</p>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className={styles.ownerBookGroup}>
          <legend className={cn(styles.h3, "chalk")}>Sending it</legend>
          <div className={styles.ownerBookRow}>
            <label className={cn(styles.label, "chalk-soft")}>
              How did they reach you?
              <select className={styles.input} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Choose…</option>
                {Object.entries(OWNER_SOURCES).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
            <label className={cn(styles.label, "chalk-soft")}>
              Their language
              <select className={styles.input} value={locale} onChange={(e) => setLocale(e.target.value === "es" ? "es" : "en")}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </label>
          </div>
        </fieldset>
        <ChalkButton type="submit" variant="solid" disabled={busy} seed={973}>{busy ? "Making it…" : "Make their link"}</ChalkButton>
        {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      </form>
    </section>
  );
}
