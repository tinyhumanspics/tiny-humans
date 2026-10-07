"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AdminApi } from "@/lib/admin/client";
import type { EmailStatus, Lead, LeadFilter, LeadList, SentEmail } from "@/lib/leads/types";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import RescheduleFlow from "@/components/Reschedule/RescheduleFlow";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

/** "All" = every non-cancelled lead; cancelled leads only appear under Cancelled. */
const FILTERS: { id: LeadFilter; label: string; alwaysShow: boolean }[] = [
  { id: "all", label: "All", alwaysShow: true },
  { id: "confirmed", label: "Confirmed", alwaysShow: true },
  { id: "rescheduled", label: "Rescheduled", alwaysShow: true },
  { id: "cancelled", label: "Cancelled", alwaysShow: true },
];
const STATUS_LABEL: Record<Lead["status"], string> = { confirmed: "Confirmed", cancelled: "Cancelled", rescheduled: "Rescheduled", pending: "Pending" };
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inspiration = findPhoto(photos, lead.inspirationPhotoId)?.title ?? (lead.inspirationPhotoId ? "Photo no longer in the portfolio" : null);
  const city = lead.address.split(",").slice(-2, -1)[0]?.trim() ?? lead.address;

  const cancel = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) return setErr("Add a cancellation reason.");
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.cancelLead(lead.reference, reason.trim());
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
    ["Final booked price", formatMoney(pr.finalCents)],
    ["Baby age", lead.babyAge],
    ["Full address", lead.address],
    ["Notes", lead.notes || "None"],
    ["Inspiration", inspiration || "None"],
    ...consentRows(lead),
    ["Outlook calendar", lead.calendarLinked ? "On the calendar" : lead.status === "cancelled" ? "Removed (cancelled)" : "Not on the calendar"],
    ["Confirmation email", emailLine(lead.confirmationEmail)],
    ["Internal notification", emailLine(lead.internalNotification)],
    ...reminderRows(lead),
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
      ["Cancellation email", emailLine(lead.cancellation.email)],
    );
  }

  return (
    <li className={cn(styles.leadCard, lead.status === "cancelled" ? styles.leadCancelled : "")}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{lead.parentName}</span>
        <span className={cn(styles.statusPill, styles[`status_${lead.status}`])}>{STATUS_LABEL[lead.status]}</span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{lead.bundleName}</b> · {formatMoney(lead.pricing.finalCents)} · {formatLongDate(lead.sessionDate)}, {formatTimeLabel(lead.start)}–{formatTimeLabel(lead.end)}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {lead.email} · {lead.phone}
        {lead.babyName ? ` · Baby: ${lead.babyName}` : ""} · At home in {city}
      </p>
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
          {lead.status !== "cancelled" && !moving && !cancelling && (
            <button type="button" className={styles.smallButton} onClick={() => setMoving(true)}>
              Reschedule Booking
            </button>
          )}
          {lead.status !== "cancelled" && !moving &&
            (cancelling ? (
              <form onSubmit={cancel} className={styles.leadCancelForm} noValidate>
                <label htmlFor={`reason-${lead.reference}`} className={cn(styles.label, "chalk-soft")}>Reason for cancellation (sent to the customer)</label>
                <textarea id={`reason-${lead.reference}`} className={cn(styles.input, styles.reasonInput)} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(err)} />
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

const sentLine = (e: SentEmail) => (e.status === "sent" ? `Sent ${when(e.at)}` : e.status === "failed" ? `Not sent (${e.error ?? "error"})` : "Sending…");

/** After the session: "Session done" (thank-you + payment link), payment status, "Gallery delivered" (review request), the review. */
function AfterSessionPanel({ lead, api, onUpdated }: { lead: Lead; api: AdminApi; onUpdated: (l: Lead) => void }) {
  const a = lead.after!;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [galleryUrl, setGalleryUrl] = useState("");
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
  const payment =
    a.payment.amountCents <= 0
      ? "Nothing to pay"
      : a.payment.status === "paid"
        ? `Paid ${amount}${a.payment.paidAt ? ` on ${when(a.payment.paidAt)}` : ""}`
        : a.payment.status === "open"
          ? `Not paid yet (${amount}). The family opened the payment page.`
          : `Not paid yet (${amount})`;
  const canRetry = (e: SentEmail | null) => !e || e.status === "failed";
  const id = `after-${lead.reference}`;
  if (lead.status === "cancelled") return null;
  return (
    <div className={styles.history}>
      <p className={cn(styles.h3, "chalk-soft")}>After the Session</p>
      <dl>
        <div>
          <dt className="chalk-soft">Thank-you + payment email</dt>
          <dd className="chalk-soft">{a.sessionDone ? sentLine(a.sessionDone) : "Not sent yet"}</dd>
        </div>
        <div>
          <dt className="chalk-soft">Payment</dt>
          <dd className="chalk-soft">{payment}</dd>
        </div>
        <div>
          <dt className="chalk-soft">Gallery + review email</dt>
          <dd className="chalk-soft">{a.gallery ? sentLine(a.gallery) : "Not sent yet"}</dd>
        </div>
      </dl>
      {canRetry(a.sessionDone) && (
        <>
          <button type="button" className={styles.smallButton} disabled={!a.canSend || busy !== null} onClick={() => run("done", () => api.sessionDone(lead.reference))}>
            {busy === "done" ? "Sending…" : a.sessionDone ? "Try again: Session done" : "Session done: send thank-you + payment link"}
          </button>
          {!a.canSend && <p className={cn(styles.hintSmall, "chalk-soft")}>Available once the session has started.</p>}
        </>
      )}
      {a.sessionDone?.status === "sent" && canRetry(a.gallery) && (
        <div className={styles.adminReschedule}>
          <label htmlFor={`${id}-gallery`} className={cn(styles.label, "chalk-soft")}>Pixieset gallery link (optional)</label>
          <input id={`${id}-gallery`} className={styles.input} type="url" inputMode="url" placeholder="https://…" value={galleryUrl} onChange={(e) => setGalleryUrl(e.target.value)} />
          <p className={cn(styles.hintSmall, "chalk-soft")}>Sends a thank-you with a link to leave a review{a.payment.status !== "paid" && a.payment.amountCents > 0 ? `, plus a ${amount} payment button (still unpaid)` : ""}.</p>
          <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => run("gallery", () => api.galleryDelivered(lead.reference, galleryUrl.trim() || undefined))}>
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
