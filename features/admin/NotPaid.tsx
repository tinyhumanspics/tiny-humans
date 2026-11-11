"use client";

import { useState } from "react";
import type { AdminApi } from "@/lib/admin/client";
import { formatLongDate } from "@/lib/booking/dates";
import type { Lead, NotPaidDue } from "@/lib/leads/types";
import { formatMoney } from "@/lib/pricing/engine";
import { cn } from "@/lib/cn";
import { smsHref, telHref } from "./contact-links";
import styles from "./Admin.module.css";

/** Leads → Not paid (owner, Nov 11): who's missing the deposit, and one button to email them a reminder. */

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(iso)) : "");
const clock = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: "America/New_York" }).format(new Date(iso)) : "");
const times = (n: number) => (n === 1 ? "1 reminder" : `${n} reminders`);
const errText = (e: unknown) => (e instanceof Error ? e.message : "Couldn't send it. Please try again.");

export const NOT_PAID_INTRO =
  "Families who haven't paid their deposit yet. “Email deposit reminder” sends them a link to pay it: everything they filled in stays saved, and each reminder is noted here.";

/** On a booking's card in Not paid: why it's unpaid, the reminder button and the reminders sent so far. */
export function DepositReminder({ lead, api, onSent }: { lead: Lead; api: AdminApi; onSent: (lead: Lead, note: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const d = lead.deposit;
  if (!d) return null;
  const amount = formatMoney(d.amountCents);
  const kind = d.status === "unpaid" ? "stripeDown" : lead.status === "pending" ? "held" : "released";
  const why =
    kind === "held" ? `Waiting for the ${amount} deposit: their time is held until ${clock(d.holdUntil)}.`
    : kind === "released" ? `Didn't pay the ${amount} deposit in time, so their time was released.`
    : `Booked while Stripe was down: the ${amount} deposit isn't paid yet.`;
  const how =
    kind === "released" ? "The reminder holds the same time again for 30 minutes (if it's still free) and emails them the link."
    : kind === "held" ? "The reminder emails them the link to pay."
    : "The reminder emails them the payment link (it takes the deposit first).";
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      const updated = kind === "stripeDown" ? await api.emailPaymentLink(lead.reference) : await api.depositLink(lead.reference, true);
      onSent(updated, `Deposit reminder emailed to ${lead.parentName} (${lead.email}).`);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const r = d.reminders;
  return (
    <div className={styles.reminderBox}>
      <p className={cn(styles.leadLine, "chalk-soft")}>{why}</p>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        {r ? `${times(r.count)} sent · last ${r.last.status === "failed" ? `one failed (${r.last.error ?? "error"})` : when(r.last.at)}.` : "No reminder sent yet."} {how}
      </p>
      <p className={styles.contactActions}>
        <button type="button" className={styles.smallButton} disabled={busy} onClick={send} aria-label={`Email deposit reminder to ${lead.parentName}`}>
          {busy ? "Sending…" : "Email deposit reminder"}
        </button>
      </p>
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
    </div>
  );
}

const DUE_WHY: Record<NotPaidDue["why"], string> = {
  pending: "Still on the payment page (it stays open for a day).",
  expired: "The payment page ran out before they paid.",
  unpaid: "Reserved while Stripe was down: the deposit isn't paid yet.",
};

/** The "Not born yet" families missing the deposit, under the bookings in Not paid. */
export function NotPaidDueList({ rows, api, onSent }: { rows: NotPaidDue[]; api: AdminApi; onSent: (note: string) => void }) {
  if (!rows.length) return null;
  return (
    <>
      <h3 className={cn(styles.h3, styles.notPaidGroup, "chalk-soft")}>Not born yet ({rows.length})</h3>
      <ul className={styles.leadList} aria-label="Not born yet, deposit not paid">
        {rows.map((row) => (
          <DueCard key={row.id} row={row} api={api} onSent={onSent} />
        ))}
      </ul>
    </>
  );
}

function DueCard({ row, api, onSent }: { row: NotPaidDue; api: AdminApi; onSent: (note: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const amount = formatMoney(row.depositCents);
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.remindDueDeposit(row.id);
      onSent(`Deposit reminder emailed to ${row.parentName} (${row.email}).`);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const r = row.reminders;
  return (
    <li className={styles.leadCard}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{row.parentName}</span>
        <span className={styles.leadPills}>
          <span className={cn(styles.statusPill, styles.status_pending)}>Not born yet</span>
          <span className={cn(styles.statusPill, styles.unpaidPill)}>{amount} deposit not paid</span>
        </span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{row.bundleName}</b> · Due {formatLongDate(row.dueDate)}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {row.email} · {row.phone} · {row.reference} · Started {when(row.createdAt)}
      </p>
      <div className={styles.reminderBox}>
        <p className={cn(styles.leadLine, "chalk-soft")}>{DUE_WHY[row.why]}</p>
        <p className={cn(styles.hintSmall, "chalk-soft")}>
          {r ? `${times(r.count)} sent · last ${when(r.lastAt)}.` : "No reminder sent yet."} The reminder emails them a link to pay the {amount} deposit (open for a day) and keeps their reservation and price.
        </p>
        <p className={styles.contactActions}>
          <a className={styles.smallButton} href={telHref(row.phone)} aria-label={`Call ${row.parentName}`}>Call</a>
          <a className={styles.smallButton} href={smsHref(row.phone, "")} aria-label={`Text ${row.parentName}`}>Text</a>
          <button type="button" className={styles.smallButton} disabled={busy} onClick={send} aria-label={`Email deposit reminder to ${row.parentName}`}>
            {busy ? "Sending…" : "Email deposit reminder"}
          </button>
        </p>
        {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
      </div>
    </li>
  );
}
