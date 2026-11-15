"use client";

import { useState } from "react";
import { BookingApiError } from "@/lib/booking";
import { fill } from "@/lib/email/messages";
import { formatMoney, type PriceQuote } from "@/lib/pricing/engine";
import { CODE_MESSAGES } from "@/lib/pricing/types";
import { cn } from "@/lib/cn";
import type en from "@/messages/en.json";
import styles from "./flow/Booking.module.css";

/**
 * The optional discount-code box, on the "Not born yet" form and the quick price box (both removed in brief 04, with
 * this box or moved to the pay-link page if codes survive brief 06).
 */
export function DiscountField({ applied, onApply, onRemove, messages, offerLabel }: { applied: string | null; onApply: (code: string) => Promise<PriceQuote>; onRemove: () => Promise<void>; messages: typeof en.bookingFlow.review.discount; offerLabel: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "info" | "error"; text: string } | null>(null);
  const apply = async () => {
    if (!code.trim()) return setNote({ kind: "error", text: messages.empty });
    setBusy(true);
    setNote(null);
    try {
      const q = await onApply(code.trim());
      const pricingNote = q.note
        ? fill(q.pricingType === "discount" ? messages.codeBetter : messages.offerBest, { offer: offerLabel })
        : "";
      setNote(
        q.pricingType === "discount"
          ? { kind: "ok", text: fill(messages.applied, { code: q.discountCode ?? "", amount: formatMoney(q.discountCents), note: pricingNote }) }
          : { kind: "info", text: pricingNote || messages.best },
      );
    } catch (e) {
      const known = e instanceof Error
        ? (Object.entries(CODE_MESSAGES) as [keyof typeof CODE_MESSAGES, string][]).find(([, text]) => text === e.message)?.[0]
        : undefined;
      const text = known
        ? messages.errors[known]
        : e instanceof BookingApiError && e.code === "network"
          ? messages.network
          : e instanceof BookingApiError && e.code === "rate_limited"
            ? messages.rateLimited
            : messages.failed;
      setNote({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.discount}>
      <label htmlFor="discount-code" className={cn(styles.discountLabel, "chalk-soft")}>{messages.label} <span className={styles.optional}>{messages.optional}</span></label>
      {applied ? (
        <p className={cn(styles.discountApplied, "chalk-soft")}>
          {messages.appliedBefore}<b>{applied}</b>{messages.appliedAfter}{" "}
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={async () => { setCode(""); setNote(null); await onRemove(); }}>{messages.remove}</button>
        </p>
      ) : (
        <div className={styles.discountRow}>
          <input id="discount-code" className={styles.input} value={code} maxLength={24} autoCapitalize="characters" autoComplete="off" placeholder={messages.placeholder} onChange={(e) => { setCode(e.target.value); setNote(null); }} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void apply())} />
          <button type="button" className={styles.discountApply} onClick={apply} disabled={busy}>{busy ? messages.checking : messages.apply}</button>
        </div>
      )}
      {note && <p className={cn(note.kind === "error" ? styles.error : styles.discountNote, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
    </div>
  );
}
