"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedbackReason, FunnelStep } from "@/config/unfinished";
import type { AdminApi, UnfinishedPeriod } from "@/lib/admin/client";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatMoney } from "@/lib/pricing/engine";
import type { UnfinishedData, UnfinishedItem, UnfinishedStage } from "@/lib/unfinished/types";
import { needsFollowUp } from "@/lib/unfinished/summary";
import AdminDialog from "./AdminDialog";
import { smsHref, telHref } from "./contact-links";
import styles from "./Admin.module.css";
import charts from "./Dashboard.module.css";
import { cn } from "@/lib/cn";

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

const STEP_LABEL: Record<FunnelStep, string> = {
  calendar: "Opened the booking form (what Meta counts as a checkout)",
  date: "Picked a date",
  time: "Picked a time",
  details: "Filled in their details",
  booked: "Pressed “Book my session”",
};

const STAGE_LABEL: Record<UnfinishedStage, string> = {
  details: "Stopped before the review page",
  review: "Stopped on the review page",
  deposit: "Didn't pay the deposit",
};

const REASON_LABEL: Record<FeedbackReason, string> = {
  price: "The price",
  travel_fee: "The travel fee",
  dates: "Dates or times didn't work",
  trust: "Wanted more photos or reviews",
  not_ready: "Not ready yet / baby not here yet",
  other_photographer: "Chose another photographer",
  other: "Something else",
};

const PERIODS = [7, 30, 90];

/** /admin → Unfinished bookings: where visitors stop, why (their answers), the families to follow up with. */
export default function UnfinishedPanel({ api }: { api: AdminApi }) {
  const [period, setPeriod] = useState<UnfinishedPeriod>({ days: 7, source: null });
  const [data, setData] = useState<UnfinishedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "all" } | { kind: "delete"; item: UnfinishedItem } | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    api
      .getUnfinished(period)
      .then((d) => ticket === latest.current && (setData(d), setError(null)))
      .catch((e: Error) => ticket === latest.current && setError(e.message));
  }, [api, period]);

  /** Runs an owner action; the list comes back fresh, with a line saying what happened. */
  const run = async (what: string, fn: () => Promise<{ data: UnfinishedData; note: string | null }>) => {
    setBusy(what);
    setError(null);
    setNote(null);
    try {
      const r = await fn();
      setData(r.data);
      setNote(r.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return error ? <p className={cn(styles.bannerError, "chalk-soft")} role="alert">{error}</p> : <p className={cn(styles.loading, "chalk-soft")}>Loading…</p>;
  if (!data.ready) {
    return (
      <p className={cn(styles.bannerError, "chalk-soft")} role="alert">
        One step left before this section works: run <b>drizzle/0022_unfinished_bookings.sql</b> in the Neon SQL editor. Until then nothing is saved, and booking works as usual.
      </p>
    );
  }

  const waiting = data.items.filter(needsFollowUp).length;
  const canSend = Boolean(data.mailingAddress);
  const sendAll = () =>
    run("all", async () => {
      const r = await api.sendUnfinishedFollowUp({ all: true }, period);
      return { data: r.data, note: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed (try again on each family)` : ""}${r.skipped ? `. ${r.skipped} more are waiting: press the button again.` : "."}` };
    });

  return (
    <div>
      <p className={cn(styles.hint, "chalk-soft")}>
        Families who typed their email on the booking form but didn&apos;t book. Anyone who books later leaves this list on
        their own. Counting started the day this section went live, so earlier visitors aren&apos;t here.
      </p>

      <Funnel data={data} period={period} onPeriod={setPeriod} />
      <Reasons data={data} />

      <section className={charts.block} aria-labelledby="unfinished-email">
        <h2 id="unfinished-email" className={cn(styles.h3, "chalk")}>“What stopped you?” email</h2>
        <p className={cn(styles.hintSmall, "chalk-soft")}>
          One email per family, in the language they used, with a link to tell you what stopped them and a button to finish
          booking. US law (CAN-SPAM) requires your mailing address at the bottom (a PO box is fine) and an unsubscribe link
          (added automatically).
        </p>
        <MailingAddress
          key={data.mailingAddress ?? ""}
          value={data.mailingAddress}
          busy={busy === "address"}
          onSave={(address) => run("address", async () => ({ data: await api.saveMailingAddress(address, period), note: address.trim() ? "Mailing address saved." : "Mailing address removed: follow-up emails are off." }))}
        />
        {!canSend && <p className={cn(styles.hintSmall, "chalk-soft")}>Add your mailing address to turn the email on.</p>}
        <div className={styles.photoBar}>
          <button type="button" className={styles.smallButton} disabled={!canSend || !waiting || busy !== null} onClick={() => setConfirm({ kind: "all" })}>
            {busy === "all" ? "Sending…" : `Send to everyone not contacted yet (${waiting})`}
          </button>
        </div>
      </section>

      {note && <p className={cn(styles.ok, "chalk-soft")} role="status">{note}</p>}
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}

      <section className={charts.block} aria-labelledby="unfinished-list">
        <h2 id="unfinished-list" className={cn(styles.h3, "chalk")}>Families ({data.items.length})</h2>
        {data.bookedLater > 0 && <p className={cn(styles.hintSmall, "chalk-soft")}>{data.bookedLater} {data.bookedLater === 1 ? "family" : "families"} from this list booked later (see Leads).</p>}
        {data.items.length === 0 ? (
          <p className={cn(charts.empty, "chalk-soft")}>Nobody yet. Families appear here once they type their email on the booking form.</p>
        ) : (
          <ul className={styles.leadList}>
            {data.items.map((item) => (
              <Family
                key={item.id}
                item={item}
                canSend={canSend}
                busy={busy}
                onSend={() => run(`send-${item.id}`, async () => ({ data: (await api.sendUnfinishedFollowUp({ id: item.id }, period)).data, note: `Email sent to ${item.parentName || item.email}.` }))}
                onDelete={() => setConfirm({ kind: "delete", item })}
              />
            ))}
          </ul>
        )}
      </section>

      {confirm && (
        <AdminDialog labelledBy="unfinished-confirm-t" describedBy="unfinished-confirm-d" onClose={() => setConfirm(null)}>
          <h3 id="unfinished-confirm-t" className={cn(styles.h3, "chalk")}>
            {confirm.kind === "all" ? `Email ${Math.min(waiting, 40)} ${waiting === 1 ? "family" : "families"}?` : `Remove ${confirm.item.parentName || confirm.item.email}?`}
          </h3>
          <p id="unfinished-confirm-d" className={cn(styles.muted, "chalk-soft")}>
            {confirm.kind === "all"
              ? `Everyone on the list who hasn't been emailed yet gets the “What stopped you?” email${waiting > 40 ? " (40 at a time)" : ""}.`
              : "Their contact details and answer are deleted from this list. Use it for tests or when a family asks."}
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setConfirm(null)}>Cancel</button>
            <button
              type="button"
              className={cn(styles.smallButton, confirm.kind === "delete" ? styles.danger : "")}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c.kind === "all") sendAll();
                else run(`delete-${c.item.id}`, async () => ({ data: await api.deleteUnfinished(c.item.id, period), note: "Removed." }));
              }}
            >
              {confirm.kind === "all" ? "Send" : "Remove"}
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}

function Funnel({ data, period, onPeriod }: { data: UnfinishedData; period: UnfinishedPeriod; onPeriod: (p: UnfinishedPeriod) => void }) {
  const steps = data.funnel.steps;
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <section className={charts.block} aria-labelledby="unfinished-funnel">
      <h2 id="unfinished-funnel" className={cn(styles.h3, "chalk")}>Where visitors stop</h2>
      <p className={cn(styles.hintSmall, "chalk-soft")}>Every visit to the booking form, counted without names or emails. Someone who looks at two bundles counts twice, like Meta.</p>
      <div className={styles.periodBar}>
        {PERIODS.map((days) => (
          <button key={days} type="button" className={cn(styles.smallButton, period.days === days ? styles.tabActive : "")} aria-pressed={period.days === days} onClick={() => onPeriod({ ...period, days })}>
            Last {days} days
          </button>
        ))}
        <span className={styles.sourcePick}>
          <label className="chalk-soft" htmlFor="unfinished-source">From</label>
          <select id="unfinished-source" className={styles.input} value={period.source ?? ""} onChange={(e) => onPeriod({ ...period, source: e.target.value || null })}>
            <option value="">Every source</option>
            {[...new Set([...(period.source ? [period.source] : []), ...data.funnel.sources])].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>
      </div>
      {steps[0]?.count ? (
        <ul className={charts.shares}>
          {steps.map((s) => (
            <li key={s.step} className={charts.share}>
              <span className={cn(charts.shareLabel, "chalk-soft")}>{STEP_LABEL[s.step]}</span>
              <span className={charts.shareTrack} aria-hidden="true">
                <span className={cn(charts.shareFill, "chalk-grain")} style={{ width: `${Math.max(s.count ? 4 : 0, (s.count / top) * 100)}%` }} />
              </span>
              <span className={cn(charts.shareValue, "chalk-soft")}>
                {s.count}
                {s.step !== "calendar" ? ` · ${Math.round((s.count / top) * 100)}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(charts.empty, "chalk-soft")}>No visits to the booking form in this period yet.</p>
      )}
    </section>
  );
}

function Reasons({ data }: { data: UnfinishedData }) {
  const top = Math.max(1, ...data.reasons.map((r) => r.count));
  return (
    <section className={charts.block} aria-labelledby="unfinished-reasons">
      <h2 id="unfinished-reasons" className={cn(styles.h3, "chalk")}>What stopped them</h2>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        {data.answered ? `${data.answered} ${data.answered === 1 ? "family" : "families"} answered. A family can pick more than one reason.` : "Answers to the “What stopped you?” email appear here."}
      </p>
      {data.reasons.length > 0 && (
        <ul className={charts.shares}>
          {data.reasons.map((r) => (
            <li key={r.reason} className={charts.share}>
              <span className={cn(charts.shareLabel, "chalk-soft")}>{REASON_LABEL[r.reason]}</span>
              <span className={charts.shareTrack} aria-hidden="true">
                <span className={cn(charts.shareFill, "chalk-grain")} style={{ width: `${Math.max(6, (r.count / top) * 100)}%` }} />
              </span>
              <span className={cn(charts.shareValue, "chalk-soft")}>{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MailingAddress({ value, busy, onSave }: { value: string | null; busy: boolean; onSave: (address: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const changed = draft.trim() !== (value ?? "");
  return (
    <div className={styles.adminReschedule}>
      <label htmlFor="unfinished-address" className={cn(styles.label, "chalk-soft")}>Mailing address for marketing emails</label>
      <input id="unfinished-address" className={styles.input} maxLength={300} placeholder="PO Box 123, Miami Beach, FL 33139" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button type="button" className={styles.smallButton} disabled={busy || !changed} onClick={() => onSave(draft)}>
        {busy ? "Saving…" : "Save address"}
      </button>
    </div>
  );
}

function Family({ item, canSend, busy, onSend, onDelete }: { item: UnfinishedItem; canSend: boolean; busy: string | null; onSend: () => void; onDelete: () => void }) {
  const name = item.parentName || item.email;
  const picked = item.sessionDate ? `${formatLongDate(item.sessionDate)}${item.start ? `, ${formatTimeLabel(item.start)}` : ""}` : null;
  const travel = item.zip ? `ZIP ${item.zip}${item.travelFeeCents ? ` (travel fee ${formatMoney(item.travelFeeCents)})` : item.travelFeeCents === 0 ? " (no travel fee)" : ""}` : null;
  const f = item.followUp;
  const sendable = !item.unsubscribed && (!f || f.status === "failed");
  return (
    <li className={styles.leadCard}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{name}</span>
        <span className={styles.leadPills}>
          <span className={styles.statusPill}>{STAGE_LABEL[item.stage]}</span>
          {item.feedback && <span className={cn(styles.statusPill, styles.paidPill)}>Answered</span>}
          {item.unsubscribed && <span className={cn(styles.statusPill, styles.unpaidPill)}>Unsubscribed</span>}
        </span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{item.bundleName ?? "Bundle not known"}</b>
        {picked ? ` · picked ${picked}` : ""}
        {travel ? ` · ${travel}` : ""}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {item.email}
        {item.phone ? ` · ${item.phone}` : ""} · {item.locale === "es" ? "Spanish" : "English"}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        Last on the form {when(item.lastSeen)}
        {item.attempts > 1 ? ` · ${item.attempts} visits` : ""} · Source: <b>{item.source ?? "Not tracked"}</b>
        {item.campaign ? ` · ${item.campaign}` : ""}
        {item.reference ? ` · ${item.reference} (under Leads, cancelled)` : ""}
      </p>
      <p className={styles.contactActions}>
        {item.phone && <a className={styles.smallButton} href={telHref(item.phone)} aria-label={`Call ${name}`}>Call</a>}
        {item.phone && <a className={styles.smallButton} href={smsHref(item.phone, "")} aria-label={`Text ${name}`}>Text</a>}
        <a className={styles.smallButton} href={`mailto:${item.email}`} aria-label={`Email ${name}`}>Email</a>
      </p>
      {item.feedback && (
        <div className={styles.adminReschedule}>
          <p className={cn(styles.label, "chalk-soft")}>Their answer ({when(item.feedback.at)})</p>
          {item.feedback.reasons.length > 0 && <p className="chalk-soft">{item.feedback.reasons.map((r) => REASON_LABEL[r] ?? r).join(" · ")}</p>}
          {item.feedback.comment && <p className="chalk-soft">“{item.feedback.comment}”</p>}
        </div>
      )}
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        “What stopped you?” email: {f ? (f.status === "sent" ? `sent ${when(f.at)}` : f.status === "failed" ? `not sent (${f.error ?? "error"})` : "sending…") : item.unsubscribed ? "they unsubscribed" : "not sent yet"}
      </p>
      <div className={styles.photoBar}>
        {sendable && (
          <button type="button" className={styles.smallButton} disabled={!canSend || busy !== null} onClick={onSend}>
            {busy === `send-${item.id}` ? "Sending…" : f ? "Try again: send the email" : "Send “What stopped you?” email"}
          </button>
        )}
        <button type="button" className={cn(styles.smallButton, styles.danger)} disabled={busy !== null} onClick={onDelete}>
          {busy === `delete-${item.id}` ? "Removing…" : "Remove from list"}
        </button>
      </div>
    </li>
  );
}
