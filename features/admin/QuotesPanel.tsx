"use client";

import { useRef, useState } from "react";
import type { AdminApi } from "@/lib/admin/client";
import { formatMoney } from "@/lib/pricing/engine";
import { EXTRA_BABY_KIND } from "@/lib/booking/extra-babies";
import { formatLongDate } from "@/lib/booking/dates";
import { zipFromText, type QuoteResult } from "@/lib/quotes/types";
import { FAMILY_INCLUDED_PEOPLE, MAX_FAMILY_MEMBERS } from "@/config/booking";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

/** What the travel fee means for this ZIP code, in plain words (same rules as the booking form). */
function travelNote(q: QuoteResult): { text: string; warn: boolean } {
  const t = q.travel;
  const from = q.baseZip ? ` from ${q.baseZip}` : "";
  switch (t.status) {
    case "free":
      return { text: `About ${t.miles} road miles${from}: no travel fee (the first ${t.freeMiles} miles are free).`, warn: false };
    case "fee":
      return { text: `About ${t.miles} road miles${from}: ${formatMoney(t.feeCents)} travel fee (first ${t.freeMiles} miles free, then ${formatMoney(t.perMileCents ?? 0)} a mile). It's in every total below.`, warn: false };
    case "too_far":
      return { text: `About ${t.miles} road miles${from}: farther than your ${t.maxMiles}-mile limit, so this family can't book online (the website asks them to text you). Prices below are without travel.`, warn: true };
    case "outside_florida":
      return { text: "That isn't a Florida ZIP code, so the website won't take the booking. Prices below are without travel.", warn: true };
    case "unknown_zip":
      return { text: "That ZIP code isn't in our Florida list (new or P.O. box ZIP codes), so the website books it with no travel fee and you confirm one. Prices below are without travel.", warn: true };
    default:
      return { text: "Travel fees aren't set up (Availability → Travel), so prices below are without travel.", warn: true };
  }
}

/**
 * Owner area → Quotes (owner, Nov 10): paste a family's address or type their ZIP code and see every bundle's price
 * today, travel included, the same numbers the booking form would give them, plus a message ready to copy into a DM.
 * Only the ZIP code is sent; the address stays on this screen.
 */
export default function QuotesPanel({ api }: { api: AdminApi }) {
  const [where, setWhere] = useState("");
  const [babies, setBabies] = useState(1);
  const [family, setFamily] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  // the owner's % off for this quote (blank = none): priced like a % discount code, so only the bigger saving counts
  const [percent, setPercent] = useState("");
  const zip = zipFromText(where);
  // only the newest request may show its prices (typing 1, then 10 sends two)
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = (values: { babies: number; family: string; percent: string }): { people: number; pct: number } | string => {
    if (!zip) return "Add the ZIP code (5 digits). If you pasted an address, it needs its ZIP code.";
    const people = Number(values.family);
    if (!Number.isInteger(people) || people < 0 || people > MAX_FAMILY_MEMBERS) return `Family members: a number from 0 to ${MAX_FAMILY_MEMBERS}.`;
    const pct = values.percent.trim() === "" ? 0 : Number(values.percent);
    if (!Number.isInteger(pct) || pct < 0 || pct > 90) return "% off: a whole number from 1 to 90 (or leave it empty).";
    return { people, pct };
  };

  const load = async (values: { babies: number; family: string; percent: string }) => {
    const ok = check(values);
    if (typeof ok === "string") return setError(ok);
    const request = ++latest.current;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const q = await api.getQuote(zip!, values.babies, ok.people, ok.pct);
      if (request !== latest.current) return;
      setQuote(q);
      setMessage(q.messages[language]);
    } catch (err) {
      if (request === latest.current) setError(errText(err, "Couldn't work out the prices. Please try again."));
    } finally {
      if (request === latest.current) setBusy(false);
    }
  };

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    void load({ babies, family, percent });
  };

  // once prices are showing, changing the % off, babies or family members updates them by itself
  const change = (next: Partial<{ babies: number; family: string; percent: string }>) => {
    const values = { babies, family, percent, ...next };
    if (next.babies !== undefined) setBabies(next.babies);
    if (next.family !== undefined) setFamily(next.family);
    if (next.percent !== undefined) setPercent(next.percent);
    if (!quote) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(values), 350);
  };

  const pickLanguage = (next: "en" | "es") => {
    setLanguage(next);
    if (quote) setMessage(quote.messages[next]);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the message and copy it yourself.");
    }
  };

  const note = quote ? travelNote(quote) : null;
  return (
    <section className={styles.section} aria-labelledby="quotes-title">
      <h2 id="quotes-title" className={cn(styles.h2, "chalk")}>Price for a family</h2>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        Booking it for a family who texted you? <a href="#owner-book-title">Go to Book it for them ↓</a>
      </p>
      <p className={cn(styles.muted, "chalk-soft")}>
        Paste the address a family sent you, or just their ZIP code, and you&apos;ll see every bundle&apos;s price today with the travel fee: the same
        numbers the booking form would give them. Then copy the message and send it.
      </p>
      <form onSubmit={run} noValidate className={styles.quoteForm}>
        <label className={cn(styles.label, "chalk-soft")}>
          Address or ZIP code
          <input className={styles.input} value={where} maxLength={200} placeholder="1234 Main St, Weston, FL 33326  ·  or  33326" onChange={(e) => (setWhere(e.target.value), setError(null))} autoComplete="off" />
        </label>
        <label className={cn(styles.label, "chalk-soft")}>
          Babies
          <select className={styles.input} value={babies} onChange={(e) => change({ babies: Number(e.target.value) })}>
            <option value={1}>1 baby</option>
            <option value={2}>Twins</option>
            <option value={3}>Triplets</option>
          </select>
        </label>
        <label className={cn(styles.label, "chalk-soft")}>
          Family members besides the {babies === 1 ? "baby" : "babies"}
          <input className={cn(styles.input, styles.timeInput)} type="number" min={0} max={MAX_FAMILY_MEMBERS} step={1} value={family} onChange={(e) => change({ family: e.target.value })} />
        </label>
        <label className={cn(styles.label, "chalk-soft")}>
          % off (optional)
          <input className={cn(styles.input, styles.timeInput)} type="number" min={1} max={90} step={1} value={percent} placeholder="10" onChange={(e) => change({ percent: e.target.value })} />
        </label>
        <ChalkButton type="submit" variant="solid" disabled={busy} seed={961}>{busy ? "Working it out…" : "Get prices"}</ChalkButton>
      </form>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        {zip ? `ZIP code ${zip}. ` : ""}Only the ZIP code is used; the address stays on this screen. Family members count only on family bundles ({FAMILY_INCLUDED_PEOPLE} people
        included, counting the baby).
      </p>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        % off takes that percent off each bundle (twins, extra family members and travel stay full price). Only one saving counts, like on the website: if a
        special offer is running, the bigger saving is used. To give a family this price when they book online, make a discount code with the same % in
        Pricing &amp; Promotions → Discount Codes.
      </p>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}

      {quote && note && (
        <div className={styles.availBlock} aria-live="polite">
          <h3 className={cn(styles.h3, "chalk")}>{`ZIP code ${quote.zip}${quote.percent ? ` · ${quote.percent}% off` : ""}`}</h3>
          <p className={cn(note.warn ? styles.bannerError : styles.banner, "chalk-soft")}>{note.text}</p>
          <div className={styles.tableWrap}>
            <table className={styles.codeTable}>
              <thead>
                <tr><th>Bundle</th><th>Bundle price</th><th>Extras</th><th>Travel</th><th>Total</th><th>Deposit to book</th></tr>
              </thead>
              <tbody>
                {quote.lines.map((l) => (
                  <tr key={l.bundleId}>
                    <td><b>{l.name}</b>{l.unavailable && <span className={styles.codeNote}>{l.unavailable}</span>}</td>
                    <td>
                      {l.bundleCents < l.regularCents ? <><s>{formatMoney(l.regularCents)}</s> <b className={styles.offerInline}>{formatMoney(l.bundleCents)}</b><span className={styles.codeNote}>{l.offerLabel}</span></> : formatMoney(l.bundleCents)}
                    </td>
                    <td>{l.addons.length ? l.addons.map((a) => `${a.kind === EXTRA_BABY_KIND ? (a.quantity === 1 ? "Twins" : "Triplets") : `${a.quantity} extra ${a.quantity === 1 ? "person" : "people"}`} ${formatMoney(a.totalCents)}`).join(", ") : "—"}</td>
                    <td>{l.travelCents ? formatMoney(l.travelCents) : "—"}</td>
                    <td><b>{l.unavailable ? "—" : formatMoney(l.totalCents)}</b></td>
                    <td>{l.unavailable || l.depositCents === null ? "—" : formatMoney(l.depositCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn(styles.hintSmall, "chalk-soft")}>Prices for a booking made today ({formatLongDate(quote.today)}). Special offers follow their last day.</p>

          <h3 className={cn(styles.h3, "chalk")}>Message to send</h3>
          <div className={styles.photoBar} role="group" aria-label="Message language">
            <div className={styles.editorActions}>
              <button type="button" className={cn(styles.smallButton, language === "en" && styles.smallButtonOn)} aria-pressed={language === "en"} onClick={() => pickLanguage("en")}>English</button>
              <button type="button" className={cn(styles.smallButton, language === "es" && styles.smallButtonOn)} aria-pressed={language === "es"} onClick={() => pickLanguage("es")}>Spanish</button>
            </div>
          </div>
          {/* the chalk texture goes on the words only: a masked label would hide the box (it only covers the first line) */}
          <label className={styles.quoteMessageField}>
            <span className={cn(styles.label, "chalk-soft")}>You can change anything before copying</span>
            <textarea className={cn(styles.input, styles.quoteMessage)} value={message} rows={Math.min(16, message.split("\n").length + 1)} onChange={(e) => (setMessage(e.target.value), setCopied(false))} />
          </label>
          <div className={styles.editorActions}>
            <ChalkButton variant="outline" onClick={copy} seed={962}>{copied ? "Copied ✓" : "Copy message"}</ChalkButton>
          </div>
        </div>
      )}
    </section>
  );
}
