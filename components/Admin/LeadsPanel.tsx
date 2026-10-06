"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { AdminApi } from "@/lib/admin/client";
import type { EmailStatus, Lead, LeadFilter, LeadList } from "@/lib/leads/types";
import { formatPrice } from "@/config/bundles";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import RescheduleFlow from "@/components/Reschedule/RescheduleFlow";
import styles from "./Admin.module.css";

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
        <h2 id="leads-title" className={`${styles.h2} chalk`}>Leads</h2>
        <button type="button" className={`${styles.linkButton} chalk-soft`} onClick={() => load(filter)} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p className={`${styles.muted} chalk-soft`}>Every booking, newest first. All shows active leads; cancelled ones stay under Cancelled as history.</p>

      <div className={styles.editTabs} role="group" aria-label="Filter leads">
        {FILTERS.filter((f) => f.alwaysShow || (data?.counts[f.id] ?? 0) > 0).map((f) => (
          <button key={f.id} type="button" className={`${styles.tab} ${filter === f.id ? styles.tabActive : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({data?.counts[f.id] ?? 0})
          </button>
        ))}
      </div>

      {error && <p className={`${styles.bannerError} chalk-soft`} role="alert">{error}</p>}
      {data && data.leads.length === 0 && !loading && <p className={`${styles.hintSmall} chalk-soft`}>No {filter === "all" ? "" : `${filter} `}leads yet.</p>}

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

  const rows: [string, string][] = [
    ["Baby age", lead.babyAge],
    ["Full address", lead.address],
    ["Notes", lead.notes || "None"],
    ["Inspiration", inspiration || "None"],
    ["Outlook calendar", lead.calendarLinked ? "On the calendar" : lead.status === "cancelled" ? "Removed (cancelled)" : "Not on the calendar"],
    ["Confirmation email", emailLine(lead.confirmationEmail)],
    ["Internal notification", emailLine(lead.internalNotification)],
  ];
  if (lead.cancellation) {
    rows.push(
      ["Cancellation reason", lead.cancellation.reason || ""],
      ["Cancelled on", `${when(lead.cancellation.at)}${lead.cancellation.by ? ` (by ${lead.cancellation.by === "admin" ? "Tiny Humans" : "the customer"})` : ""}`],
      ["Cancellation email", emailLine(lead.cancellation.email)],
    );
  }

  return (
    <li className={`${styles.leadCard} ${lead.status === "cancelled" ? styles.leadCancelled : ""}`}>
      <div className={styles.leadHead}>
        <span className={`${styles.leadName} chalk-soft`}>{lead.parentName}</span>
        <span className={`${styles.statusPill} ${styles[`status_${lead.status}`]}`}>{STATUS_LABEL[lead.status]}</span>
      </div>
      <p className={`${styles.leadLine} chalk-soft`}>
        <b>{lead.bundleName}</b> · {formatPrice(lead.packagePrice)} · {formatLongDate(lead.sessionDate)}, {formatTimeLabel(lead.start)}–{formatTimeLabel(lead.end)}
      </p>
      <p className={`${styles.leadMeta} chalk-soft`}>
        {lead.email} · {lead.phone}
        {lead.babyName ? ` · Baby: ${lead.babyName}` : ""} · At home in {city}
      </p>
      <p className={`${styles.leadMeta} chalk-soft`}>
        {lead.reference} · Booked {when(lead.createdAt)}
      </p>
      {lead.cancellation && (
        <p className={`${styles.leadCancelNote} chalk-soft`}>
          Cancelled on {when(lead.cancellation.at)}: “{lead.cancellation.reason}”
        </p>
      )}
      <button type="button" className={`${styles.linkButton} chalk-soft`} aria-expanded={open} onClick={onToggle}>
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
              <p className={`${styles.h3} chalk-soft`}>Reschedule History</p>
              <ol className={styles.historyList}>
                <li>
                  <b className="chalk-soft">Original Appointment</b>
                  <span className="chalk-soft">{formatLongDate(lead.history[0].oldDate)}, {formatTimeLabel(lead.history[0].oldStart)}</span>
                </li>
                {lead.history.map((h, i) => (
                  <li key={h.at}>
                    <b className="chalk-soft">{i === 0 ? "Rescheduled" : "Rescheduled Again"}</b>
                    <span className="chalk-soft">{formatLongDate(h.newDate)}, {formatTimeLabel(h.newStart)}</span>
                    <span className={`${styles.historyMeta} chalk-soft`}>By {h.by === "admin" ? "Admin" : "Customer"} · {when(h.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {lead.status !== "cancelled" && moving && (
            <div className={styles.adminReschedule}>
              <p className={`${styles.h3} chalk-soft`}>Reschedule Booking</p>
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
                <label htmlFor={`reason-${lead.reference}`} className={`${styles.label} chalk-soft`}>Reason for cancellation (sent to the customer)</label>
                <textarea id={`reason-${lead.reference}`} className={`${styles.input} ${styles.reasonInput}`} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(err)} />
                {err && <p className={`${styles.error} chalk-soft`} role="alert">{err}</p>}
                <div className={styles.photoBar}>
                  <button type="button" className={`${styles.linkButton} chalk-soft`} onClick={() => { setCancelling(false); setErr(null); }}>Keep booking</button>
                  <ChalkButton type="submit" variant="solid" disabled={busy} seed={890}>{busy ? "Cancelling…" : "Confirm cancellation"}</ChalkButton>
                </div>
                <p className={`${styles.hintSmall} chalk-soft`}>This removes the Outlook event, frees the time and emails the customer.</p>
              </form>
            ) : (
              <button type="button" className={`${styles.smallButton} ${styles.danger}`} onClick={() => setCancelling(true)}>
                Cancel Booking
              </button>
            ))}
          <div className={styles.dangerZone}>
            <p className={`${styles.hintSmall} chalk-soft`}>Delete is permanent and meant for test bookings. To keep the history, use Cancel instead.</p>
            <button type="button" className={`${styles.smallButton} ${styles.deleteBtn}`} onClick={() => setConfirmDelete(true)}>Delete Lead</button>
          </div>
        </div>
      )}
      {confirmDelete && createPortal(
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={`del-t-${lead.reference}`} aria-describedby={`del-d-${lead.reference}`} onClick={(e) => e.stopPropagation()}>
            <h3 id={`del-t-${lead.reference}`} className={`${styles.h3} chalk`}>Delete this lead permanently?</h3>
            <p id={`del-d-${lead.reference}`} className={`${styles.muted} chalk-soft`}>
              This will permanently remove the booking record and cannot be undone. ({lead.parentName}, {lead.reference})
              {lead.status !== "cancelled" ? " Its Outlook event is removed first; no emails are sent." : ""}
            </p>
            {deleteErr && <p className={`${styles.error} chalk-soft`} role="alert">{deleteErr}</p>}
            <div className={styles.photoBar}>
              <button type="button" className={styles.smallButton} onClick={() => setConfirmDelete(false)} disabled={deleting} autoFocus>Cancel</button>
              <button type="button" className={`${styles.smallButton} ${styles.deleteBtn}`} onClick={doDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete Permanently"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </li>
  );
}
