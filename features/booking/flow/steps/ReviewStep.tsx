"use client";

import { useState } from "react";
import Link from "next/link";
import { bundlesHref, STEP } from "@/config/booking";
import { formatMoney, type PriceQuote } from "@/lib/pricing/engine";
import { BookingApiError, formatLongDate, formatTimeLabel } from "@/lib/booking";
import { CODE_MESSAGES } from "@/lib/pricing/types";
import { unitLine } from "@/lib/booking/templates";
import { travelFeeValue } from "@/lib/travel/format";
import { backdropNames } from "@/lib/booking/backdrop-names";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import { bookingBabiesLabel, bookingPricingRows } from "@/lib/booking/customer-page-format";
import { fill } from "@/lib/email/messages";
import InspirationThumb from "@/features/booking/InspirationThumb";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import BabyLedNote from "../BabyLedNote";
import type { BookingFlow } from "../useBookingFlow";
import styles from "../Booking.module.css";
import { cn } from "@/lib/cn";

/** Step 4: everything the family chose, the price (calculated by the server), an optional code and the deposit. */
export default function ReviewStep({ flow, locale, messages }: { flow: BookingFlow; locale: AppLocale; messages: typeof en.bookingFlow }) {
  const { state, bundle, selection, quote, setQuote, appliedCode, setAppliedCode, provider, addon, bundleCents, beforeTravelCents, travel, travelFee, depositOffer, depositCents, deposit, totalCents, inspiration, setups, backdrops, goTo } = flow;
  return (
    <>
      {bundle && state.date && state.slot && (
        <Review
          messages={messages.review}
          rows={[
            { label: messages.review.labels.package, value: bundle.name, step: -1, href: bundlesHref(selection.inspirationId, locale) },
            ...(quote
              ? bookingPricingRows(quote, bundle, messages.review)
              : ([
                  [messages.review.labels.bundleTotal, formatMoney(bundleCents)],
                  ...(addon ? [[addon.quantity === 1 ? messages.review.labels.extraBaby : messages.review.labels.extraBabies, `${addon.quantity} × ${formatMoney(addon.unitPriceCents)} = ${formatMoney(addon.totalCents)}`]] : []),
                  ...(addon ? [[messages.review.labels.sessionTotalBeforeTravel, formatMoney(beforeTravelCents)]] : []),
                ] as [string, string][])
            ).map(([label, value]) => ({ label, value, step: -1 })),
            ...(travelFee > 0
              ? [
                  { label: messages.review.labels.travelFee, value: travelFeeValue(travelFee, travel?.miles ?? null, messages.details.travel), step: STEP.details },
                  { label: messages.review.labels.total, value: formatMoney(beforeTravelCents + travelFee), step: -1 },
                ]
              : []),
            ...(depositCents > 0
              ? [
                  { label: messages.review.deposit.today, value: fill(messages.review.deposit.value, { deposit }), step: -1 },
                  { label: messages.review.deposit.rest, value: formatMoney(totalCents - depositCents), step: -1 },
                ]
              : [{ label: messages.review.labels.paymentDue, value: messages.review.labels.afterPhotoshoot, step: -1 }]),
            ...(inspiration ? [{ label: messages.review.labels.inspiration, value: inspiration.title, step: -1, photo: inspiration }] : []),
            { label: messages.review.labels.date, value: formatLongDate(state.date, locale), step: STEP.date },
            { label: messages.review.labels.time, value: fill(messages.review.timeRange, { start: formatTimeLabel(state.slot.start, locale), end: formatTimeLabel(state.slot.end, locale), zone: messages.time.zone }), step: STEP.time },
            { label: messages.review.labels.location, value: `${[state.contact.street.trim(), unitLine(state.contact.unit, messages.review.unit), state.contact.city.trim()].filter(Boolean).join(", ")} ${state.contact.zip.trim()}`, step: STEP.details },
            ...(state.contact.access.trim() ? [{ label: messages.review.labels.access, value: state.contact.access.trim(), step: STEP.details }] : []),
            { label: messages.review.labels.parent, value: state.contact.parentName, step: STEP.details },
            { label: messages.review.labels.email, value: state.contact.email, step: STEP.details },
            { label: messages.review.labels.phone, value: state.contact.phone, step: STEP.details },
            { label: state.babies.length > 1 ? messages.review.labels.babies : messages.review.labels.baby, value: bookingBabiesLabel(state.babies, messages.details), step: STEP.details },
            ...(state.contact.notes.trim() ? [{ label: messages.review.labels.notes, value: state.contact.notes.trim(), step: STEP.details }] : []),
            { label: setups > 1 ? messages.review.labels.backdrops : messages.review.labels.backdrop, value: backdrops.length ? backdropNames(backdrops, messages.details.backdrops.names, messages.review.and) : messages.review.labels.backdropNone, step: STEP.details },
            { label: messages.review.labels.texts, value: state.consents.sms ? messages.review.labels.textsYes : messages.review.labels.textsNo, step: STEP.details },
            { label: messages.review.labels.photos, value: state.consents.photos ? messages.review.labels.photosYes : messages.review.labels.photosNo, step: STEP.details },
          ]}
          onEdit={goTo}
        />
      )}
      {bundle && (
        <DiscountField
          key={bundle.id}
          applied={appliedCode}
          messages={messages.review.discount}
          offerLabel={bundle.offer?.label?.trim() || messages.review.labels.specialOffer}
          onApply={async (code) => {
            const q = await provider.quote(bundle.id, code, state.contact.email.trim(), state.babies.length);
            setQuote(q);
            setAppliedCode(q.pricingType === "discount" ? q.discountCode : null);
            return q;
          }}
          onRemove={async () => {
            setAppliedCode(null);
            setQuote(await provider.quote(bundle.id, undefined, undefined, state.babies.length).catch(() => null));
          }}
        />
      )}
      <BabyLedNote messages={messages.babyLed} compact multiple={state.babies.length > 1} />
      {depositCents > 0 && (
        <p className={cn(styles.depositNote, "chalk-soft")}>{fill(messages.review.deposit.partOfTotal, { deposit, total: formatMoney(totalCents), rest: formatMoney(totalCents - depositCents) })}</p>
      )}
      {depositCents > 0 && depositOffer && (
        <p className={cn(styles.depositNote, "chalk-soft")}>{fill(messages.review.deposit.note, { notice: noticeLabel(depositOffer.noticeHours, messages.review.deposit.notice) })}</p>
      )}
    </>
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

function Review({ rows, onEdit, messages }: { rows: ReviewRow[]; onEdit: (step: number) => void; messages: typeof en.bookingFlow.review }) {
  return (
    <dl className={styles.review}>
      {rows.map((r) => (
        <div key={r.label} className={styles.reviewRow}>
          <dt className={cn(styles.reviewLabel, "chalk-soft")}>{r.label}</dt>
          <dd className={cn(styles.reviewValue, "chalk-soft")}>
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
              <Link href={r.href} className={cn(styles.linkButton, "chalk-soft")} aria-label={fill(messages.changeAria, { label: r.label.toLocaleLowerCase() })}>
                {messages.change}
              </Link>
            )}
            {r.step >= 0 && (
              <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => onEdit(r.step)} aria-label={fill(messages.editAria, { label: r.label.toLocaleLowerCase() })}>
                {messages.edit}
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- optional discount code (review step) ---------------- */

function DiscountField({ applied, onApply, onRemove, messages, offerLabel }: { applied: string | null; onApply: (code: string) => Promise<PriceQuote>; onRemove: () => Promise<void>; messages: typeof en.bookingFlow.review.discount; offerLabel: string }) {
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
