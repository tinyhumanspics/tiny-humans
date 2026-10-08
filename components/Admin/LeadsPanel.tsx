"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AdminApi } from "@/lib/admin/client";
import type { EmailStatus, Lead, LeadDeposit, LeadFilter, LeadList, SentEmail } from "@/lib/leads/types";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { ACCESS_LABEL, travelOwnerLine } from "@/lib/booking/templates";
import { backdropNames } from "@/lib/booking/backdrop-names";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import RescheduleFlow from "@/components/Reschedule/RescheduleFlow";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";
import en from "@/messages/en.json";
import { babiesLabel } from "@/lib/booking/extra-babies";

/** "All" = every non-cancelled lead; cancelled leads only appear under Cancelled. */
const FILTERS: { id: LeadFilter; label: string; alwaysShow: boolean }[] = [
  { id: "all", label: "All", alwaysShow: true },
  { id: "confirmed", label: "Confirmed", alwaysShow: true },
  { id: "rescheduled", label: "Rescheduled", alwaysShow: true },
  { id: "cancelled", label: "Cancelled", alwaysShow: true },
];
const STATUS_LABEL: Record<Lead["status"], string> = { confirmed: "Confirmed", cancelled: "Cancelled", rescheduled: "Rescheduled", pending: "Pending" };
const statusLabel = (lead: Lead) => (lead.status === "pending" && lead.deposit?.status === "pending" ? "Waiting for deposit" : lead.status === "cancelled" && lead.deposit?.status === "expired" ? "Deposit not paid" : STATUS_LABEL[lead.status]);
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");
const emailLine = (e: EmailStatus) => (e.sent ? `Sent ${when(e.at)}` : e.error ? `Not sent (${e.error})` : "Not sent");
/** Optional permissions from the booking form (server mode only). */
const consentRows = (lead: Lead): [string, string][] => {
  const c = lead.consents;
  if (!c) return [];
  return [
    ["Texts", c.sms ? `OK to text${c.smsAt ? ` (since ${when(c.smsAt)})` : ""}` : c.smsAt ? `Don't text (changed ${when(c.smsAt)})` : "Not OK to text"],
    ["Photo use", c.photos ? `OK to feature on the website + social media${c.photosAt ? ` (since ${when(c.photosAt)})` : ""}` : c.photosAt ? `Keep private (changed ${when(c.photosAt)})` : "Keep private"],
  ];
};
const clock = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone: "America/New_York" }).format(new Date(iso)) : "");
/** The deposit, in the owner's words. */
function depositLine(d: LeadDeposit, cancelled: boolean): string {
  const amount = formatMoney(d.amountCents);
  switch (d.status) {
    case "pending":
      return `${amount}: waiting for the family to pay on Stripe (their time is held until ${clock(d.holdUntil)})`;
    case "paid":
      if (d.refundError) return `${amount} paid ${when(d.paidAt)}. The automatic refund FAILED (${d.refundError}): use “Refund the deposit” below, or refund it in Stripe`;
      return cancelled ? `${amount} kept (paid ${when(d.paidAt)}, not refunded)` : `${amount} paid ${when(d.paidAt)}`;
    case "refunded":
      return `${amount} refunded ${when(d.refundedAt)}`;
    case "expired":
      return `${amount} not paid: the payment page closed and the time was released`;
    case "unpaid":
      return `${amount} NOT PAID: Stripe was down when they booked. Send them the payment link (it takes the deposit first)`;
  }
}
const depositRows = (lead: Lead): [string, string][] => {
  const d = lead.deposit;
  if (!d) return [];
  const rows: [string, string][] = [["Deposit", depositLine(d, lead.status === "cancelled")]];
  if (d.status === "expired") rows.push(["“Not confirmed yet” email", d.abandonedEmail ? sentLine(d.abandonedEmail) : "Not sent (they booked again, or chose another time themselves)"]);
  return rows;
};
type EmailProblem = NonNullable<Lead["emailProblems"]>[number];
const PROBLEM_TAG: Record<EmailProblem["kind"], string> = { bounced: "Email bounced", complained: "Marked as spam", suppressed: "Email blocked", failed: "Email failed" };
/** What Resend reported, in the owner's words (newest first, at most 3). */
function problemLine(p: EmailProblem): string {
  const why = p.detail ? ` (${p.detail})` : "";
  switch (p.kind) {
    case "bounced":
      return `The ${p.email} bounced ${when(p.at)}${why}. Text the family to check their email address.`;
    case "complained":
      return `The ${p.email} was marked as spam ${when(p.at)}. Don't email them again: text instead.`;
    case "suppressed":
      return `The ${p.email} wasn't sent ${when(p.at)}: this address bounced or marked an email as spam before. Text the family.`;
    case "failed":
      return `The ${p.email} couldn't be sent ${when(p.at)}${why}. Text the family.`;
  }
}
const problemRows = (lead: Lead): [string, string][] => (lead.emailProblems ?? []).slice(0, 3).map((p, i) => [i ? `Email problem ${i + 1}` : "Email problem", problemLine(p)]);
const duplicateLine = (lead: Lead) => {
  const duplicate = lead.duplicate;
  if (!duplicate) return null;
  const sameBoth = duplicate.emailReferences.filter((reference) => duplicate.phoneReferences.includes(reference));
  const emailOnly = duplicate.emailReferences.filter((reference) => !sameBoth.includes(reference));
  const phoneOnly = duplicate.phoneReferences.filter((reference) => !sameBoth.includes(reference));
  return [
    sameBoth.length ? `same email and phone as ${sameBoth.join(", ")}` : "",
    emailOnly.length ? `same email as ${emailOnly.join(", ")}` : "",
    phoneOnly.length ? `same phone as ${phoneOnly.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
};
const REMINDER_LABEL = { "72h": "Reminder (3 days before)", "24h": "Reminder (day before)" } as const;
/** Reminder emails for the current session time (none in the prototype, where nothing is sent). */
const reminderRows = (lead: Lead): [string, string][] => {
  if (!lead.reminders || lead.status === "cancelled") return [];
  if (!lead.reminders.length) return [["Reminders", "None sent yet"]];
  return lead.reminders.map((r) => [REMINDER_LABEL[r.kind], r.status === "sent" ? `Sent ${when(r.at)}` : r.status === "failed" ? `Not sent (${r.error ?? "error"}). Text the family.` : "Sending…"]);
};

/** Owner area: every booking/lead, filterable, with details and admin cancellation. */
export default function LeadsPanel({ api }: { api: AdminApi }) {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [data, setData] = useState<LeadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    async (f: LeadFilter, offset = 0) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listLeads(f, offset);
        setData((prev) => (offset && prev ? { ...res, leads: [...prev.leads, ...res.leads] } : res));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load leads.");
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const onDeleted = () => {
    setOpen(null);
    void load(filter);
  };

  const onCancelled = (lead: Lead) => {
    // refresh counts + list so the cancellation shows immediately
    void load(filter);
    setOpen(lead.reference);
  };

  return (
    <section className={styles.section} aria-labelledby="leads-title">
      <div className={styles.leadsTop}>
        <h2 id="leads-title" className={cn(styles.h2, "chalk")}>Leads</h2>
        <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => load(filter)} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p className={cn(styles.muted, "chalk-soft")}>Every booking, newest first. All shows active leads; cancelled ones stay under Cancelled as history.</p>

      <div className={styles.editTabs} role="group" aria-label="Filter leads">
        {FILTERS.filter((f) => f.alwaysShow || (data?.counts[f.id] ?? 0) > 0).map((f) => (
          <button key={f.id} type="button" className={cn(styles.tab, filter === f.id ? styles.tabActive : "")} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({data?.counts[f.id] ?? 0})
          </button>
        ))}
      </div>

      {error && <p className={cn(styles.bannerError, "chalk-soft")} role="alert">{error}</p>}
      {data && data.leads.length === 0 && !loading && <p className={cn(styles.hintSmall, "chalk-soft")}>No {filter === "all" ? "" : `${filter} `}leads yet.</p>}

      <ul className={styles.leadList}>
        {data?.leads.map((lead) => (
          <LeadCard key={lead.reference} lead={lead} api={api} open={open === lead.reference} onToggle={() => setOpen(open === lead.reference ? null : lead.reference)} onCancelled={onCancelled} onDeleted={onDeleted} />
        ))}
      </ul>
      {data && data.leads.length < data.total && (
        <button type="button" className={styles.smallButton} onClick={() => load(filter, data.leads.length)} disabled={loading}>
          Show more
        </button>
      )}
    </section>
  );
}

function LeadCard({ lead, api, open, onToggle, onCancelled, onDeleted }: { lead: Lead; api: AdminApi; open: boolean; onToggle: () => void; onCancelled: (l: Lead) => void; onDeleted: () => void }) {
  const { photos } = useSiteSettings();
  const [cancelling, setCancelling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const doDelete = async () => {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await api.deleteLead(lead.reference);
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Couldn't delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };
  const [reason, setReason] = useState("");
  const depositPaid = lead.deposit?.status === "paid";
  // inside the notice window a deposit is normally kept (owner's terms); the owner can still tick it
  const [refund, setRefund] = useState(!lead.deposit?.late);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inspiration = findPhoto(photos, lead.inspirationPhotoId)?.title ?? (lead.inspirationPhotoId ? "Photo no longer in the portfolio" : null);
  const city = lead.address.split(",").slice(-2, -1)[0]?.trim() ?? lead.address;
  const duplicate = duplicateLine(lead);

  const cancel = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) return setErr("Add a cancellation reason.");
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.cancelLead(lead.reference, reason.trim(), depositPaid ? refund : undefined);
      setCancelling(false);
      setReason("");
      onCancelled(updated);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Couldn't cancel. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const pr = lead.pricing;
  const rows: [string, string][] = [
    ["Pricing type", pr.pricingType === "offer" ? "Special Offer" : pr.pricingType === "discount" ? "Discount Code" : "Regular"],
    ["Regular price", formatMoney(pr.regularCents)],
    ...(pr.pricingType === "offer" ? [["Offer", `${pr.offerLabel ?? "Special offer"}: ${formatMoney(pr.offerCents ?? pr.finalCents)}`] as [string, string]] : []),
    ...(pr.pricingType === "discount" ? [["Discount code", pr.discountCode ?? ""] as [string, string], ["Discount amount", formatMoney(pr.discountCents)] as [string, string]] : []),
    ["Final bundle price", formatMoney(pr.finalCents)],
    ...pr.addons.map((a) => [a.name, `${a.quantity} × ${formatMoney(a.unitPriceCents)} = ${formatMoney(a.totalCents)}`] as [string, string]),
    ...(lead.travel ? [["Travel", travelOwnerLine(lead.travel)] as [string, string]] : []),
    ...((pr.addonsCents > 0 || lead.travel?.feeCents) ? [["Total due", formatMoney(pr.totalCents + (lead.travel?.feeCents ?? 0))] as [string, string]] : []),
    ...depositRows(lead),
    [lead.babies && lead.babies.length > 1 ? "Babies" : "Baby", babiesLabel(lead.babies ?? [{ name: lead.babyName ?? undefined, age: lead.babyAge }])],
    ["Full address", lead.address],
    [ACCESS_LABEL, lead.access || "None"],
    ...(lead.backdrops !== undefined
      ? [["Backdrop", lead.backdrops?.picks.length ? `${backdropNames(lead.backdrops.picks)}${lead.backdrops.source === "family" ? ` (changed by the family ${when(lead.backdrops.at)})` : ""}` : "Not chosen yet"] as [string, string]]
      : []),
    ["Notes", lead.notes || "None"],
    ["Inspiration", inspiration || "None"],
    ...consentRows(lead),
    ["Outlook calendar", lead.calendarLinked ? "On the calendar" : lead.status === "cancelled" ? "Removed (cancelled)" : lead.deposit?.status === "pending" ? "Not yet (added once the deposit is paid)" : "Not on the calendar"],
    ["Confirmation email", emailLine(lead.confirmationEmail)],
    ["Internal notification", emailLine(lead.internalNotification)],
    ...reminderRows(lead),
    ...problemRows(lead),
    ...(duplicate ? [["Possible duplicate", duplicate] as [string, string]] : []),
    ...(lead.source
      ? ([
          ["Source", lead.source.label + (lead.source.metaClick ? " (Meta click id)" : "")],
          ["Campaign / ad set / ad", [lead.source.campaign, lead.source.term, lead.source.content].map((v) => v || "–").join(" / ")],
          ["Medium", lead.source.medium || "–"],
          ["First page visited", lead.source.landingPath || "–"],
          ["Came from site", lead.source.referrer || "–"],
          ["First visit", lead.source.at ? when(lead.source.at) : "–"],
        ] as [string, string][])
      : ([["Source", "Not tracked (booked before source tracking)"]] as [string, string][])),
  ];
  if (lead.cancellation) {
    rows.push(
      ["Cancellation reason", lead.cancellation.reason || ""],
      ["Cancelled on", `${when(lead.cancellation.at)}${lead.cancellation.by ? ` (by ${lead.cancellation.by === "admin" ? "Tiny Humans" : "the customer"})` : ""}`],
      // a time released for an unpaid deposit was never booked: no cancellation email
      ...(lead.deposit?.status === "expired" ? [] : ([["Cancellation email", emailLine(lead.cancellation.email)]] as [string, string][])),
    );
  }

  return (
    <li className={cn(styles.leadCard, lead.status === "cancelled" ? styles.leadCancelled : "")}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{lead.parentName}</span>
        <span className={styles.leadPills}>
          <span className={cn(styles.statusPill, styles[`status_${lead.status}`])}>{statusLabel(lead)}</span>
          <PaidTag lead={lead} />
          {duplicate && <span className={cn(styles.statusPill, styles.duplicatePill)}>Possible duplicate</span>}
          {lead.emailProblems?.[0] && <span className={cn(styles.statusPill, styles.unpaidPill)}>{PROBLEM_TAG[lead.emailProblems[0].kind]}</span>}
        </span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{lead.bundleName}</b> · {formatMoney(lead.pricing.totalCents + (lead.travel?.feeCents ?? 0))}
        {lead.travel?.feeCents ? ` (incl. ${formatMoney(lead.travel.feeCents)} travel)` : ""} · {formatLongDate(lead.sessionDate)}, {formatTimeLabel(lead.start)}–{formatTimeLabel(lead.end)}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {lead.email} · {lead.phone}
        {lead.babies && lead.babies.length > 1 ? ` · ${lead.babies.length} babies` : lead.babyName ? ` · Baby: ${lead.babyName}` : ""} · At home in {city}
      </p>
      {duplicate && <p className={cn(styles.duplicateNote, "chalk-soft")}>Possible duplicate: {duplicate}.</p>}
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {lead.reference} · Booked {when(lead.createdAt)} · Source: <b>{lead.source?.label ?? "Not tracked"}</b>
        {lead.source?.campaign ? ` · ${lead.source.campaign}` : ""}
      </p>
      {lead.cancellation && (
        <p className={cn(styles.leadCancelNote, "chalk-soft")}>
          Cancelled on {when(lead.cancellation.at)}: “{lead.cancellation.reason}”
        </p>
      )}
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} aria-expanded={open} onClick={onToggle}>
        {open ? "Hide details" : "View details"}
      </button>
      {open && (
        <div className={styles.leadDetails}>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="chalk-soft">{k}</dt>
                <dd className="chalk-soft">{v}</dd>
              </div>
            ))}
          </dl>
          {lead.history.length > 0 && (
            <div className={styles.history}>
              <p className={cn(styles.h3, "chalk-soft")}>Reschedule History</p>
              <ol className={styles.historyList}>
                <li>
                  <b className="chalk-soft">Original Appointment</b>
                  <span className="chalk-soft">{formatLongDate(lead.history[0].oldDate)}, {formatTimeLabel(lead.history[0].oldStart)}</span>
                </li>
                {lead.history.map((h, i) => (
                  <li key={h.at}>
                    <b className="chalk-soft">{i === 0 ? "Rescheduled" : "Rescheduled Again"}</b>
                    <span className="chalk-soft">{formatLongDate(h.newDate)}, {formatTimeLabel(h.newStart)}</span>
                    <span className={cn(styles.historyMeta, "chalk-soft")}>By {h.by === "admin" ? "Admin" : "Customer"} · {when(h.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {lead.after && <PaymentPanel lead={lead} api={api} onUpdated={onCancelled} />}
          {lead.after && <AfterSessionPanel lead={lead} api={api} onUpdated={onCancelled} />}
          {lead.consents && lead.status !== "cancelled" && <ConsentButtons lead={lead} api={api} onUpdated={onCancelled} />}
          {lead.status !== "cancelled" && moving && (
            <div className={styles.adminReschedule}>
              <p className={cn(styles.h3, "chalk-soft")}>Reschedule Booking</p>
              <RescheduleFlow
                idPrefix={`adm-${lead.reference}`}
                current={{ date: lead.sessionDate, start: lead.start, end: lead.end }}
                loadDays={(from, to) => api.leadAvailability(lead.reference, from, to)}
                submit={async (slot) => {
                  try {
                    const updated = await api.rescheduleLead(lead.reference, slot);
                    setMoving(false);
                    onCancelled(updated);
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Couldn't reschedule.";
                    throw Object.assign(new Error(msg), { code: /just booked/i.test(msg) ? "slot_unavailable" : undefined });
                  }
                }}
                onKeep={() => setMoving(false)}
                keepLabel="Keep current time"
              />
            </div>
          )}
          {lead.status !== "cancelled" && lead.status !== "pending" && !moving && !cancelling && (
            <button type="button" className={styles.smallButton} onClick={() => setMoving(true)}>
              Reschedule Booking
            </button>
          )}
          {lead.status !== "cancelled" && lead.status !== "pending" && !moving &&
            (cancelling ? (
              <form onSubmit={cancel} className={styles.leadCancelForm} noValidate>
                <label htmlFor={`reason-${lead.reference}`} className={cn(styles.label, "chalk-soft")}>Reason for cancellation (sent to the customer)</label>
                <textarea id={`reason-${lead.reference}`} className={cn(styles.input, styles.reasonInput)} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(err)} />
                {depositPaid && (
                  <>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
                      <span className="chalk-soft">Refund the {formatMoney(lead.deposit!.amountCents)} deposit to their card</span>
                    </label>
                    <p className={cn(styles.hintSmall, "chalk-soft")}>
                      {lead.deposit!.late ? "The session is inside the cancel notice, so the deposit is normally kept (your Terms). Tick it to refund anyway." : "Outside the cancel notice the deposit is refunded (your Terms)."}
                    </p>
                  </>
                )}
                {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
                <div className={styles.photoBar}>
                  <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => { setCancelling(false); setErr(null); }}>Keep booking</button>
                  <ChalkButton type="submit" variant="solid" disabled={busy} seed={890}>{busy ? "Cancelling…" : "Confirm cancellation"}</ChalkButton>
                </div>
                <p className={cn(styles.hintSmall, "chalk-soft")}>This removes the Outlook event, frees the time and emails the customer.</p>
              </form>
            ) : (
              <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => setCancelling(true)}>
                Cancel Booking
              </button>
            ))}
          <div className={styles.dangerZone}>
            <p className={cn(styles.hintSmall, "chalk-soft")}>Delete is permanent and meant for test bookings. To keep the history, use Cancel instead.</p>
            <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={() => setConfirmDelete(true)}>Delete Lead</button>
          </div>
        </div>
      )}
      {confirmDelete && createPortal(
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={`del-t-${lead.reference}`} aria-describedby={`del-d-${lead.reference}`} onClick={(e) => e.stopPropagation()}>
            <h3 id={`del-t-${lead.reference}`} className={cn(styles.h3, "chalk")}>Delete this lead permanently?</h3>
            <p id={`del-d-${lead.reference}`} className={cn(styles.muted, "chalk-soft")}>
              This will permanently remove the booking record and cannot be undone. ({lead.parentName}, {lead.reference})
              {lead.status !== "cancelled" ? " Its Outlook event is removed first; no emails are sent." : ""}
              {lead.deposit?.status === "paid" ? ` Its ${formatMoney(lead.deposit.amountCents)} deposit is refunded to their card.` : ""}
              {lead.deposit?.status === "pending" ? " Its Stripe deposit page is closed first, so it can't be paid anymore." : ""}
            </p>
            {deleteErr && <p className={cn(styles.error, "chalk-soft")} role="alert">{deleteErr}</p>}
            <div className={styles.photoBar}>
              <button type="button" className={styles.smallButton} onClick={() => setConfirmDelete(false)} disabled={deleting} autoFocus>Cancel</button>
              <button type="button" className={cn(styles.smallButton, styles.deleteBtn)} onClick={doDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete Permanently"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </li>
  );
}

/** "Paid $149" on the lead card, or "Not paid" once the session has ended. */
function PaidTag({ lead }: { lead: Lead }) {
  const a = lead.after;
  const d = lead.deposit;
  if (!a || lead.status === "cancelled" || lead.status === "pending") return null;
  const deposit = d?.status === "paid" ? d.amountCents : 0;
  if (d?.status === "unpaid" && !a.ended) return <span className={cn(styles.statusPill, styles.unpaidPill)}>Deposit not paid</span>;
  if (a.payment.amountCents <= 0) return deposit ? <span className={cn(styles.statusPill, styles.paidPill)}>Paid {formatMoney(deposit)}</span> : null;
  if (a.payment.status === "paid") return <span className={cn(styles.statusPill, styles.paidPill)}>Paid {formatMoney(a.payment.amountCents + deposit)}</span>;
  if (a.ended) return <span className={cn(styles.statusPill, styles.unpaidPill)}>Not paid</span>;
  return deposit ? <span className={cn(styles.statusPill, styles.paidPill)}>Deposit {formatMoney(deposit)}</span> : null;
}

const sentLine = (e: SentEmail) => (e.status === "sent" ? `Sent ${when(e.at)}` : e.status === "failed" ? `Not sent (${e.error ?? "error"})` : "Sending…");

/** After the session: "Send sneak peek" (thank-you + Pixieset gallery to choose favorites + pay button if unpaid), "Gallery delivered" (review request), the review. */
function AfterSessionPanel({ lead, api, onUpdated }: { lead: Lead; api: AdminApi; onUpdated: (l: Lead) => void }) {
  const a = lead.after!;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // before the session these can still be sent, after a confirm (owner, Oct 7)
  const [early, setEarly] = useState<{ what: "done" | "gallery"; fn: () => Promise<Lead> } | null>(null);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [peekUrl, setPeekUrl] = useState("");
  const [favorites, setFavorites] = useState(a.favorites ?? "");
  const run = async (what: string, fn: () => Promise<Lead>) => {
    setBusy(what);
    setErr(null);
    try {
      onUpdated(await fn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  const amount = formatMoney(a.payment.amountCents);
  const canRetry = (e: SentEmail | null) => !e || e.status === "failed";
  const sendOrConfirm = (what: "done" | "gallery", fn: () => Promise<Lead>) => (a.started ? run(what, fn) : setEarly({ what, fn }));
  const id = `after-${lead.reference}`;
  if (lead.status === "cancelled" || lead.status === "pending") return null;
  return (
    <div className={styles.history}>
      <p className={cn(styles.h3, "chalk-soft")}>After the Session</p>
      <dl>
        <div>
          <dt className="chalk-soft">Sneak peek email</dt>
          <dd className="chalk-soft">{a.sessionDone ? sentLine(a.sessionDone) : "Not sent yet"}</dd>
        </div>
        <div>
          <dt className="chalk-soft">Gallery + review email</dt>
          <dd className="chalk-soft">{a.gallery ? sentLine(a.gallery) : "Not sent yet"}</dd>
        </div>
      </dl>
      {canRetry(a.sessionDone) && a.canSend && (
          <div className={styles.adminReschedule}>
            <label htmlFor={`${id}-peek`} className={cn(styles.label, "chalk-soft")}>Pixieset sneak peek link</label>
            <input id={`${id}-peek`} className={styles.input} type="url" inputMode="url" placeholder="https://…" value={peekUrl} onChange={(e) => setPeekUrl(e.target.value)} />
            <label htmlFor={`${id}-favorites`} className={cn(styles.label, "chalk-soft")}>Favorites they can choose</label>
            <input id={`${id}-favorites`} className={styles.input} inputMode="numeric" maxLength={12} value={favorites} onChange={(e) => setFavorites(e.target.value)} />
            <p className={cn(styles.hintSmall, "chalk-soft")}>
              Sends a thank-you with your gallery and &ldquo;choose your {favorites.trim() || "…"} favorites&rdquo;
              {a.payment.amountCents > 0 ? (a.payment.status === "paid" ? ". They've already paid, so there's no payment button." : `, plus a ${amount} payment button (not paid yet).`) : "."}
            </p>
            <button type="button" className={styles.smallButton} disabled={busy !== null || !peekUrl.trim() || !favorites.trim()} onClick={() => sendOrConfirm("done", () => api.sendSneakPeek(lead.reference, peekUrl.trim(), favorites.trim()))}>
              {busy === "done" ? "Sending…" : a.sessionDone ? "Try again: send sneak peek" : "Send sneak peek"}
            </button>
          </div>
      )}
      {a.sessionDone?.status === "sent" && canRetry(a.gallery) && (
        <div className={styles.adminReschedule}>
          <label htmlFor={`${id}-gallery`} className={cn(styles.label, "chalk-soft")}>Final gallery link (optional)</label>
          <input id={`${id}-gallery`} className={styles.input} type="url" inputMode="url" placeholder="https://…" value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} />
          <p className={cn(styles.hintSmall, "chalk-soft")}>Sends a thank-you with a link to leave a review{a.payment.status !== "paid" && a.payment.amountCents > 0 ? `, plus a ${amount} payment button (still unpaid)` : ""}.</p>
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => sendOrConfirm("gallery", () => api.galleryDelivered(lead.reference, galleryUrl.trim() || undefined))}>
            {busy === "gallery" ? "Sending…" : a.gallery ? "Try again: Gallery delivered" : "Gallery delivered: send review request"}
          </button>
        </div>
      )}
      {a.review && (
        <div className={styles.adminReschedule}>
          <p className={cn(styles.label, "chalk-soft")}>
            Review: {"★".repeat(a.review.rating)}
            {"☆".repeat(5 - a.review.rating)} · {a.review.displayName}
          </p>
          <p className="chalk-soft">“{a.review.body}”</p>
          <p className={cn(styles.hintSmall, "chalk-soft")}>
            {when(a.review.at)} · {a.review.consentPublic ? "OK to show on the website" : "Private: the family didn't say OK to show it"}
            {a.review.approved ? " · Picked for the website" : ""}
          </p>
          {a.review.consentPublic && (
            <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => run("review", () => api.setReviewApproved(lead.reference, !a.review!.approved))}>
              {busy === "review" ? "Saving…" : a.review.approved ? "Don't use on the website" : "Use on the website"}
            </button>
          )}
        </div>
      )}
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
      {early &&
        createPortal(
          <div className={styles.dialogBackdrop} role="presentation" onClick={() => setEarly(null)}>
            <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-early-t`} aria-describedby={`${id}-early-d`} onClick={(e) => e.stopPropagation()}>
              <h3 id={`${id}-early-t`} className={cn(styles.h3, "chalk")}>The session hasn&apos;t happened yet</h3>
              <p id={`${id}-early-d`} className={cn(styles.muted, "chalk-soft")}>
                {lead.parentName}&apos;s session is on {formatLongDate(lead.sessionDate)} at {formatTimeLabel(lead.start)}. Send the {early.what === "done" ? "sneak peek" : "gallery and review request"} anyway?
              </p>
              <div className={styles.photoBar}>
                <button type="button" className={styles.smallButton} onClick={() => setEarly(null)} autoFocus>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => {
                    setEarly(null);
                    run(early.what, early.fn);
                  }}
                >
                  Send anyway
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Record a family's change of mind (e.g. they replied STOP). */
function ConsentButtons({ lead, api, onUpdated }: { lead: Lead; api: AdminApi; onUpdated: (l: Lead) => void }) {
  const c = lead.consents!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const change = async (next: { sms?: boolean; photos?: boolean }) => {
    setBusy(true);
    setErr(null);
    try {
      onUpdated(await api.setConsent(lead.reference, next));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.photoBarRight}>
      <button type="button" className={styles.smallButton} disabled={busy} onClick={() => change({ sms: !c.sms })}>
        {c.sms ? "They replied STOP: don't text" : "They said OK to texts"}
      </button>
      <button type="button" className={styles.smallButton} disabled={busy} onClick={() => change({ photos: !c.photos })}>
        {c.photos ? "Keep their photos private" : "They said OK to feature photos"}
      </button>
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
    </div>
  );
}

/** "sms:" link that opens Messages with the text filled in (works on iPhone and Android). */
function smsHref(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return `sms:${number}?&body=${encodeURIComponent(body)}`;
}

/** Payment: status + the booking's payment link (never expires) to text, copy or email — before or after the session. */
function PaymentPanel({ lead, api, onUpdated }: { lead: Lead; api: AdminApi; onUpdated: (l: Lead) => void }) {
  const p = lead.after!.payment;
  const d = lead.deposit;
  const [busy, setBusy] = useState<"email" | "check" | "refund" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canRefund = d?.status === "paid" && (lead.status === "cancelled" || Boolean(d.refundError));
  const refund = async () => {
    setBusy("refund");
    setErr(null);
    setNote(null);
    try {
      onUpdated(await api.refundDeposit(lead.reference));
      setNote("Refunded. It usually reaches their card in 5–10 business days.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't refund. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  if (lead.status === "cancelled" || lead.status === "pending") {
    return canRefund ? (
      <div className={styles.history}>
        <p className={cn(styles.h3, "chalk-soft")}>Deposit</p>
        <div className={styles.photoBarRight}>
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={refund}>
            {busy === "refund" ? "Refunding…" : `Refund the ${formatMoney(d!.amountCents)} deposit`}
          </button>
        </div>
        {note && <p className={cn(styles.hintSmall, "chalk-soft")} role="status">{note}</p>}
        {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
      </div>
    ) : null;
  }
  const amount = formatMoney(p.amountCents);
  const nextAmount = formatMoney(p.next.amountCents);
  const status =
    p.amountCents <= 0
      ? "Nothing to pay"
      : p.status === "paid"
        ? `Paid ${amount}${p.paidAt ? ` on ${when(p.paidAt)}` : ""}`
        : p.status === "open"
          ? `Not paid yet (${amount}). The family opened the payment page.`
          : `Not paid yet (${amount})`;
  const showLink = p.link && (p.status !== "paid" || p.next.kind === "deposit");
  const copy = async () => {
    setErr(null);
    try {
      await navigator.clipboard.writeText(p.link!);
      setNote("Link copied.");
    } catch {
      setNote(null);
      setErr("Couldn't copy. Press and hold the link below to copy it.");
    }
  };
  const email = async () => {
    setBusy("email");
    setErr(null);
    setNote(null);
    try {
      onUpdated(await api.emailPaymentLink(lead.reference));
      setNote(`Emailed to ${lead.email}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  const check = async () => {
    setBusy("check");
    setErr(null);
    setNote(null);
    try {
      const updated = await api.checkPayment(lead.reference);
      onUpdated(updated);
      setNote(updated.after?.payment.status === "paid" ? "Stripe confirms it's paid. Updated." : "Stripe has no payment for this booking yet.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't check with Stripe. Please try again.");
    } finally {
      setBusy(null);
    }
  };
  const first = lead.parentName.split(" ")[0];
  return (
    <div className={styles.history}>
      <p className={cn(styles.h3, "chalk-soft")}>Payment</p>
      <dl>
        <div>
          <dt className="chalk-soft">Status</dt>
          <dd className="chalk-soft">{status}</dd>
        </div>
        {d && d.status !== "expired" && d.status !== "pending" && (
          <div>
            <dt className="chalk-soft">Deposit</dt>
            <dd className="chalk-soft">{depositLine(d, false)}</dd>
          </div>
        )}
        {p.linkEmail && (
          <div>
            <dt className="chalk-soft">Payment link email</dt>
            <dd className="chalk-soft">{sentLine(p.linkEmail)}</dd>
          </div>
        )}
      </dl>
      {(p.amountCents > 0 && p.status !== "paid") || d?.status === "unpaid" ? (
        <div className={styles.photoBarRight}>
          <span className={cn(styles.hintSmall, "chalk-soft")}>Paid, but it still says not paid?</span>
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={check}>
            {busy === "check" ? "Checking…" : "Check with Stripe"}
          </button>
        </div>
      ) : null}
      {canRefund && (
        <div className={styles.photoBarRight}>
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={refund}>
            {busy === "refund" ? "Refunding…" : `Refund the ${formatMoney(d!.amountCents)} deposit`}
          </button>
        </div>
      )}
      {showLink && (
        <>
          <p className={cn(styles.hintSmall, "chalk-soft")}>
            {p.next.kind === "deposit"
              ? `This link never expires. Before the session it takes the ${nextAmount} deposit; after that it charges the rest. Send it any time.`
              : `This link never expires and always charges ${amount}. Send it any time, before or after the session.`}
          </p>
          <div className={styles.photoBarRight}>
            <a className={styles.smallButton} href={smsHref(lead.phone, en.emails.paymentLink.smsBody.replace("{name}", first).replace("{url}", p.link!))}>
              Text the link
            </a>
            <button type="button" className={styles.smallButton} onClick={copy}>
              Copy link
            </button>
            <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={email}>
              {busy === "email" ? "Sending…" : "Email the link"}
            </button>
          </div>
          <input className={styles.input} readOnly value={p.link!} aria-label="Payment link" onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
      {note && <p className={cn(styles.hintSmall, "chalk-soft")} role="status">{note}</p>}
      {err && <p className={cn(styles.error, "chalk-soft")} role="alert">{err}</p>}
    </div>
  );
}
