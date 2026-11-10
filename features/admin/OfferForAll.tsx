"use client";

import { useState } from "react";
import type { AdminApi } from "@/lib/admin/client";
import type { AdminBundle } from "@/lib/pricing/types";
import { activeOffer, formatMoney, MAX_OFFER_PERCENT, percentOffCents, toCents } from "@/lib/pricing/engine";
import { promoLine, promoSummary } from "@/lib/pricing/promo";
import { formatLongDate } from "@/lib/booking/dates";
import ChalkButton from "@/components/ui/ChalkButton/ChalkButton";
import en from "@/messages/en.json";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Note = { kind: "ok" | "error"; text: string } | null;
const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const list = (names: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names);
const longDate = (key: string) => formatLongDate(key).replace(/^[^,]+, /, "");

/** What families read on the Bundles page right now (the same line), or null when no offer runs. */
export function offerLineNow(bundles: AdminBundle[], today: string): string | null {
  const summary = promoSummary(bundles, today);
  return summary ? promoLine(summary, en.bundlesPage.promo, list, longDate) : null;
}

/**
 * Pricing → "Same offer on every bundle" (owner, Nov 10): one percent, label and last day for every active bundle,
 * each price worked out from its own regular price. Each bundle can still be changed on its own afterwards (Edit).
 */
export default function OfferForAll({ api, bundles, today, onSaved }: { api: AdminApi; bundles: AdminBundle[]; today: string; onSaved: (bundles: AdminBundle[], text: string) => void }) {
  const live = bundles.filter((b) => b.active !== false);
  const offers = live.map((b) => activeOffer(b, today));
  // prefill with the offer every bundle shares today, if there is one
  const shared = offers.every((o) => o && o.percent && o.percent === offers[0]?.percent && o.label === offers[0]?.label && o.endsOn === offers[0]?.endsOn) ? offers[0] : null;
  const [percent, setPercent] = useState(shared?.percent ? String(shared.percent) : "");
  const [label, setLabel] = useState(shared && live[0]?.offer?.label ? shared.label : "");
  const [labelEs, setLabelEs] = useState(shared ? live[0]?.spanish?.offerLabel ?? "" : "");
  const [endsOn, setEndsOn] = useState(shared?.endsOn ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const pct = Number(percent);
  const pctOk = Number.isInteger(pct) && pct >= 1 && pct <= MAX_OFFER_PERCENT;
  const anyOn = bundles.some((b) => b.offer?.enabled);
  const lineNow = offerLineNow(bundles, today);

  const apply = async () => {
    if (!pctOk) return setNote({ kind: "error", text: `Enter the percent off: a whole number from 1 to ${MAX_OFFER_PERCENT}.` });
    if (!endsOn) return setNote({ kind: "error", text: "Add the last day of the offer." });
    if (endsOn < today) return setNote({ kind: "error", text: "The last day can't be in the past." });
    setBusy(true);
    setNote(null);
    try {
      const r = await api.applyOfferToAll({ percent: pct, label: label.trim() || null, labelEs: labelEs.trim() || null, endsOn });
      if (!labelEs.trim()) setLabelEs(r.bundles.find((b) => b.active !== false)?.spanish?.offerLabel ?? "");
      onSaved(r.bundles, `${pct}% off is on ${r.count} bundle${r.count === 1 ? "" : "s"} through ${longDate(endsOn)}. The website, booking and emails use the new prices now.`);
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't save the offer.") });
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    setBusy(true);
    setNote(null);
    try {
      onSaved(await api.endOffersForAll(), "Special offers ended: every bundle shows its regular price again.");
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't end the offers.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.offerAll} role="group" aria-labelledby="offer-all-title">
      <h3 id="offer-all-title" className={cn(styles.h3, "chalk")}>Same offer on every bundle</h3>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        {lineNow ? <>Right now the Bundles page and the ad page say: <b>&ldquo;{lineNow}&rdquo;</b></> : "No special offer is running: every bundle shows its regular price."}
      </p>
      <div className={styles.editorGrid}>
        <label className={cn(styles.label, "chalk-soft")}>Percent off (%)<input className={styles.input} type="number" min={1} max={MAX_OFFER_PERCENT} step={1} value={percent} placeholder="10" onChange={(e) => (setPercent(e.target.value), setNote(null))} /></label>
        <label className={cn(styles.label, "chalk-soft")}>Offer label<input className={styles.input} value={label} maxLength={30} placeholder="Thanksgiving offer" onChange={(e) => (setLabel(e.target.value), setNote(null))} /></label>
        <label className={cn(styles.label, "chalk-soft")}>Last day<input className={cn(styles.input, styles.timeInput)} type="date" min={today} value={endsOn} onChange={(e) => (setEndsOn(e.target.value), setNote(null))} /></label>
        <label className={cn(styles.label, "chalk-soft")}>Offer label (Spanish){label.trim() ? " · blank = translated for you" : " · optional"}<input className={styles.input} value={labelEs} maxLength={30} placeholder="Oferta de Acción de Gracias" onChange={(e) => (setLabelEs(e.target.value), setNote(null))} /></label>
      </div>
      {pctOk && (
        <ul className={cn(styles.offerAllPrices, "chalk-soft")} aria-label="New prices">
          {live.map((b) => (
            <li key={b.id}>{b.name}: <s>{formatMoney(toCents(b.price))}</s> <b className={styles.offerInline}>{formatMoney(percentOffCents(toCents(b.price), pct))}</b></li>
          ))}
        </ul>
      )}
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        Replaces each active bundle&apos;s own special offer. Twins/triplets and extra family members stay full price, and a discount code is used only
        when it gives a better price. The Bundles page and the ad page show a line about the offer by themselves, and it all goes away after the last day.
      </p>
      {note && <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
      <div className={styles.editorActions}>
        <ChalkButton variant="solid" onClick={apply} disabled={busy} seed={934}>{busy ? "Saving…" : "Put this offer on every bundle"}</ChalkButton>
        {anyOn && <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={end} disabled={busy}>End offers on every bundle</button>}
      </div>
    </div>
  );
}
