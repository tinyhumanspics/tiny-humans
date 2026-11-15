"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookingCalendar from "@/features/booking/BookingCalendar";
import type { AdminApi } from "@/lib/admin/client";
import { formatLongDate, formatShortDate, formatTimeLabel, fromDateKey, toDateKey } from "@/lib/booking/dates";
import type { TimeSlot } from "@/lib/booking/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/pricing/engine";
import type { RequestConfirmed, RequestListItem } from "@/lib/requests/types";
import en from "@/messages/en.json";
import AdminDialog from "./AdminDialog";
import { smsHref } from "./contact-links";
import styles from "./Admin.module.css";

const errText = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const miami = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

/** "4 min ago", "3 h ago", "2 days ago" */
export function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 60) return min <= 1 ? "just now" : `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} ${Math.floor(h / 24) === 1 ? "day" : "days"} ago`;
}

/** "Held 11 h 52 min more" or null once it lapsed. */
export function holdLeft(iso: string | null, now: number): string | null {
  const min = iso ? Math.floor((new Date(iso).getTime() - now) / 60_000) : -1;
  if (min < 1) return null;
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

const whenOf = (r: RequestListItem) => (r.type === "due_date" && r.dueDate ? `Due date: ${formatLongDate(r.dueDate)}` : r.slotDate && r.slotStart ? `${formatLongDate(r.slotDate)} · ${formatTimeLabel(r.slotStart)}` : "—");
const travelOf = (r: RequestListItem) =>
  r.travelStatus === "fee" ? `travel +${formatMoney(r.travelFeeCents)} (${r.travelMiles} mi)` : r.travelStatus === "free" ? `travel free${r.travelMiles !== null ? ` (${r.travelMiles} mi)` : ""}` : "no travel fee";
/** "TH-…: booked for Thursday, December 3 · 4:00 pm (another time); their pay link is out (Leads → Not paid)." */
function madeLine(r: RequestListItem, made: NonNullable<RequestListItem["made"]>): string {
  const moved = made.date && made.start && (made.date !== r.slotDate || made.start !== r.slotStart) ? ` for ${formatLongDate(made.date)} · ${formatTimeLabel(made.start)} (another time)` : "";
  return r.status === "confirmed" ? `${made.reference}${moved}: their pay link is out (Leads → Not paid).` : `${made.reference}${moved} in Leads.`;
}
const STATUS: Record<RequestListItem["status"], string> = { new: "New", confirmed: "Waiting on the deposit", booked: "Booked", declined: "Declined", expired: "Expired" };

/**
 * /admin → Requests (brief 02): what families sent from /book. Text them, confirm (the owner booking: their time is
 * held 48 h, they get the pay link by email and in your text), book another time, or decline. New ones first.
 */
export default function RequestsPanel({ api }: { api: AdminApi }) {
  const [data, setData] = useState<{ requests: RequestListItem[]; notReady?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .listRequests()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(errText(e, "Couldn't load the requests.")));
    return () => {
      live = false;
    };
  }, [api, tick]);

  // the clock for "4 min ago" and the hold, and a fresh list every minute (a new request shows up by itself)
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    const list = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => (clearInterval(clock), clearInterval(list));
  }, []);

  const requests = data?.requests ?? [];
  const open = requests.filter((r) => r.status === "new");
  const rest = requests.filter((r) => r.status !== "new");
  const refresh = () => setTick((n) => n + 1);

  return (
    <section className={styles.section} aria-labelledby="requests-title">
      <h2 id="requests-title" className={cn(styles.h2, "chalk")}>{open.length ? `${open.length} new` : "Nothing new"}</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        Requests from the booking page. A requested time stays held from other families for 12 hours while it&apos;s new. Confirm opens a text to them with
        the pay link (they get it by email too); their time is then held 48 hours for the deposit.
      </p>
      {data?.notReady && <p className={cn(styles.banner, "chalk-soft")} role="status">{data.notReady}</p>}
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      {!data && !error && <p className={cn(styles.muted, "chalk-soft")} role="status">Loading…</p>}
      {data && !data.notReady && requests.length === 0 && <p className={cn(styles.muted, "chalk-soft")}>No requests yet.</p>}
      {open.length > 0 && (
        <ul className={styles.leadList} aria-label="New requests">
          {open.map((r) => <RequestCard key={r.id} r={r} api={api} now={now} onChanged={refresh} />)}
        </ul>
      )}
      {rest.length > 0 && (
        <>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide answered requests" : `Show answered requests (${rest.length})`}
          </button>
          {showDone && (
            <ul className={styles.leadList} aria-label="Answered requests">
              {rest.map((r) => <RequestCard key={r.id} r={r} api={api} now={now} onChanged={refresh} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function RequestCard({ r, api, now, onChanged }: { r: RequestListItem; api: AdminApi; now: number; onChanged: () => void }) {
  const [busy, setBusy] = useState<"confirm" | "decline" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RequestConfirmed | null>(null);
  const [other, setOther] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const held = r.status === "new" && r.type === "date" ? holdLeft(r.holdUntil, now) : null;
  const total = r.totalCents + r.travelFeeCents;

  const confirm = async (slot?: { date: string; start: string }) => {
    setBusy("confirm");
    setError(null);
    try {
      const result = await api.confirmRequest(r.id, slot);
      setDone(result);
      setOther(false);
      // on a phone, straight into Messages with the text written
      if (window.matchMedia("(pointer: coarse)").matches) window.location.href = smsHref(r.mobile, result.sms);
    } catch (e) {
      setError(errText(e, "Couldn't confirm it. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const decline = async (email: boolean) => {
    setDeclining(false);
    setBusy("decline");
    setError(null);
    try {
      const result = await api.declineRequest(r.id, email);
      if (result.emailError) setError(result.emailError);
      onChanged();
    } catch (e) {
      setError(errText(e, "Couldn't decline it. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setDeleting(false);
    setBusy("delete");
    setError(null);
    try {
      await api.deleteRequest(r.id);
      onChanged();
    } catch (e) {
      setError(errText(e, "Couldn't delete it. Please try again."));
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  return (
    <li className={styles.leadCard} id={`request-${r.reference}`}>
      <div className={styles.leadHead}>
        <span className={cn(styles.leadName, "chalk-soft")}>{r.firstName}</span>
        <span className={styles.leadPills}>
          <span className={cn(styles.statusPill, r.status === "booked" && styles.paidPill)}>{STATUS[r.status]}</span>
          {r.locale === "es" && <span className={styles.statusPill}>Spanish</span>}
        </span>
      </div>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        <b>{whenOf(r)}</b>
      </p>
      <p className={cn(styles.leadLine, "chalk-soft")}>
        {`${r.bundleName}${r.babyCount === 2 ? " · twins" : r.babyCount === 3 ? " · triplets" : ""} · ${formatMoney(total)} · ZIP ${r.zip}, ${travelOf(r)}`}
      </p>
      <p className={cn(styles.leadMeta, "chalk-soft")}>
        {[`${r.mobile} · ${r.email}`, r.textConsent ? "OK to text: yes" : "OK to text: not ticked", `sent ${ago(r.createdAt, now)}`].join(" · ")}
      </p>
      {r.status === "new" && r.type === "date" && <p className={cn(styles.hintSmall, "chalk-soft")}>{held ? `Held for them ${held} more.` : "The 12-hour hold ended: other families can pick this time now."}</p>}
      {r.made && !done && <p className={cn(styles.hintSmall, "chalk-soft")}>{madeLine(r, r.made)}</p>}

      {done ? (
        <div className={styles.availBlock} role="status">
          <p className={cn(styles.banner, "chalk-soft")}>
            {done.status === "pending"
              ? `✓ ${done.reference}: ${done.holdUntil ? `time held until ${miami(done.holdUntil)}. ` : ""}${done.emailed ? "We emailed them the link." : (done.emailError ?? "No email was sent: text them the link.")}`
              : `✓ ${done.reference}: booked, nothing to pay. ${done.emailed ? "They got the confirmation email." : ""}`}
          </p>
          <p className={styles.contactActions}>
            <a className={styles.smallButton} href={smsHref(r.mobile, done.sms)}>{`Text ${r.firstName} ${done.url ? "the link" : "the news"}`}</a>
            <button type="button" className={styles.smallButton} onClick={() => copy(done.sms)}>{copied ? "Text copied ✓" : "Copy the text"}</button>
            <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={onChanged}>Done</button>
          </p>
        </div>
      ) : (
        <div className={styles.photoBar}>
          {r.status !== "declined" && <a className={styles.smallButton} href={smsHref(r.mobile, r.hello)} aria-label={`Text ${r.firstName}`}>Text</a>}
          {r.status === "new" && (
            <>
              <button type="button" className={styles.smallButton} disabled={busy !== null} onClick={() => confirm()}>{busy === "confirm" && !other ? "Confirming…" : "Confirm & send pay link"}</button>
              <button type="button" className={styles.smallButton} disabled={busy !== null} aria-expanded={other} onClick={() => setOther((v) => !v)}>Other time</button>
              <button type="button" className={cn(styles.smallButton, styles.danger)} disabled={busy !== null} onClick={() => setDeclining(true)}>{busy === "decline" ? "Declining…" : "Decline"}</button>
            </>
          )}
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} disabled={busy !== null} onClick={() => setDeleting(true)}>{busy === "delete" ? "Deleting…" : "Delete"}</button>
        </div>
      )}
      {other && !done && <OtherTime r={r} api={api} busy={busy === "confirm"} onPick={confirm} />}
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}

      {deleting && (
        <AdminDialog labelledBy={`delete-t-${r.id}`} describedBy={`delete-d-${r.id}`} onClose={() => setDeleting(false)}>
          <h3 id={`delete-t-${r.id}`} className={cn(styles.h3, "chalk")}>{`Delete ${r.firstName}'s request for good?`}</h3>
          <p id={`delete-d-${r.id}`} className={cn(styles.muted, "chalk-soft")}>
            {`For tests and spam: it's removed from this list and can't be brought back${r.status === "new" && r.type === "date" ? ", and its time opens up for other families" : ""}. No email is sent.${r.made ? ` ${r.made.reference} stays in Leads.` : ""}`}
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setDeleting(false)}>Cancel</button>
            <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={remove}>Delete for good</button>
          </div>
        </AdminDialog>
      )}
      {declining && (
        <AdminDialog labelledBy={`decline-t-${r.id}`} describedBy={`decline-d-${r.id}`} onClose={() => setDeclining(false)}>
          <h3 id={`decline-t-${r.id}`} className={cn(styles.h3, "chalk")}>{`Decline ${r.firstName}'s request?`}</h3>
          <p id={`decline-d-${r.id}`} className={cn(styles.muted, "chalk-soft")}>
            {`${r.type === "date" ? "Their time is released for other families and the request" : "The request"} moves to Answered. You can email them a short, kind note (${r.locale === "es" ? "in Spanish" : "in English"}) that asks them to text you for another day.`}
          </p>
          <div className={styles.photoBar}>
            <button type="button" className={styles.smallButton} onClick={() => setDeclining(false)}>Cancel</button>
            <button type="button" className={styles.smallButton} onClick={() => decline(false)}>Decline, no email</button>
            <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => decline(true)}>Decline and email them</button>
          </div>
        </AdminDialog>
      )}
    </li>
  );
}

/** "Other time": your calendar for their bundle and babies; tapping a time books that one instead. */
function OtherTime({ r, api, busy, onPick }: { r: RequestListItem; api: AdminApi; busy: boolean; onPick: (slot: { date: string; start: string }) => void }) {
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = fromDateKey(r.slotDate && r.slotDate > today ? r.slotDate : today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [date, setDate] = useState("");
  const monthKey = toDateKey(month).slice(0, 7);
  const [cal, setCal] = useState<{ month: string; days?: Record<string, TimeSlot[]>; error?: string } | null>(null);
  const ready = cal?.month === monthKey;
  const days = ready ? (cal.days ?? {}) : {};

  useEffect(() => {
    let live = true;
    const first = `${monthKey}-01`;
    const last = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    api
      .ownerSlots({ bundle: r.bundleId, babies: r.babyCount, from: first < today ? today : first, to: last })
      .then((list) => live && setCal({ month: monthKey, days: Object.fromEntries(list.filter((d) => d.slots.length).map((d) => [d.date, d.slots])) }))
      .catch((e) => live && setCal({ month: monthKey, error: errText(e, "Couldn't load your calendar.") }));
    return () => {
      live = false;
    };
  }, [api, r.bundleId, r.babyCount, monthKey, month, today]);

  const times = date && ready ? (days[date] ?? []) : null;
  return (
    <div className={styles.ownerBookCalendar}>
      <p className={cn(styles.hintSmall, "chalk-soft")}>Pick the day and time you agreed with them: it&apos;s booked right away, with the same pay link and text.</p>
      <BookingCalendar todayKey={today} month={month} onMonthChange={setMonth} days={days} loading={!ready} selected={date || null} onSelect={setDate} messages={en.bookingFlow.calendar} locale="en" />
      {cal?.error && ready && <p className={cn(styles.error, "chalk-soft")} role="alert">{cal.error}</p>}
      <div role="group" aria-label="Time" className={styles.ownerBookTimes}>
        {!date ? (
          <p className={cn(styles.hintSmall, "chalk-soft")}>Pick a bright day to see its times.</p>
        ) : times?.length ? (
          <>
            <p className={cn(styles.ownerBookDay, "chalk-soft")}>{formatShortDate(date)}</p>
            {times.map((s) => (
              <button key={s.start} type="button" className={styles.smallButton} disabled={busy} onClick={() => onPick({ date, start: s.start })}>
                {`Book ${formatTimeLabel(s.start)}`}
              </button>
            ))}
          </>
        ) : (
          <p className={cn(styles.hintSmall, "chalk-soft")}>{times ? "No open times that day. Pick another day." : "Checking the calendar…"}</p>
        )}
      </div>
      <p className={cn(styles.hintSmall, "chalk-soft")}>
        Need something the calendar doesn&apos;t allow? Use <Link href="/admin/quotes">Quotes / Booking</Link>.
      </p>
    </div>
  );
}
