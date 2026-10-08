"use client";

import { useEffect, useState, type FormEvent } from "react";
import { bookingRules } from "@/config/booking";
import type { AdminApi } from "@/lib/admin/client";
import type { AvailabilityRules, BookingLimits, CloseDayResult, ClosedDayImpact, WeeklyDay } from "@/lib/availability/types";
import { WEEKDAY_NAMES } from "@/lib/availability/types";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatMoney } from "@/lib/pricing/engine";
import type { TravelExample, TravelSettings } from "@/lib/travel/types";
import { todayInZone } from "@/lib/booking/timezone";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import styles from "./Admin.module.css";
import { cn } from "@/lib/cn";

type Note = { kind: "ok" | "error"; text: string } | null;

/** Monday first, Sunday last, as people read a week. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const NOTICE_OPTIONS = [0, 1, 2, 3];
const WINDOW_OPTIONS = [7, 14, 30, 60, 90];
const BUFFER_OPTIONS = [0, 15, 30, 45, 60, 90];
const RESCHEDULE_OPTIONS = [12, 24, 48, 72];

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Owner area: when families can book (weekly hours, rules, special dates, time blocks). */
export default function AvailabilityPanel({ api }: { api: AdminApi }) {
  const [rules, setRules] = useState<AvailabilityRules | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAvailability()
      .then((r) => {
        setRules(r.rules);
        setDbReady(r.databaseConfigured);
      })
      .catch((e) => setLoadError(errText(e, "Couldn't load availability.")));
  }, [api]);

  return (
    <section className={styles.section} aria-labelledby="availability-title">
      <h2 id="availability-title" className={cn(styles.h2, "chalk")}>Availability</h2>
      <p className={cn(styles.muted, "chalk-soft")}>
        Families can only book times inside these hours that are also free in your Outlook calendar.
      </p>
      {!dbReady && (
        <p className={cn(styles.bannerError, "chalk-soft")} role="alert">
          The database isn&apos;t connected yet, so changes can&apos;t be saved. Showing the default hours.
        </p>
      )}
      {loadError && (
        <p className={cn(styles.error, "chalk-soft")} role="alert">
          {loadError}
        </p>
      )}
      {rules && (
        <>
          <WeeklyAndRules rules={rules} api={api} onSaved={setRules} />
          <SpecialDates rules={rules} api={api} onSaved={setRules} />
          <TimeBlocks rules={rules} api={api} onSaved={setRules} />
          <TravelFees api={api} />
        </>
      )}
    </section>
  );
}

/* ---------------- weekly schedule + booking rules ---------------- */

function WeeklyAndRules({ rules, api, onSaved }: { rules: AvailabilityRules; api: AdminApi; onSaved: (r: AvailabilityRules) => void }) {
  const [weekly, setWeekly] = useState<WeeklyDay[]>(rules.weekly);
  const [limits, setLimits] = useState<BookingLimits>(rules.limits);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const L = bookingRules.limits;

  const setDay = (weekday: number, patch: Partial<WeeklyDay>) => {
    setWeekly((w) => w.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
    setDirty(true);
    setNote(null);
  };
  const setLimit = (patch: Partial<BookingLimits>) => {
    setLimits((l) => ({ ...l, ...patch }));
    setDirty(true);
    setNote(null);
  };

  const save = async () => {
    const bad = weekly.find((d) => d.isOpen && d.end <= d.start);
    if (bad) return setNote({ kind: "error", text: `${WEEKDAY_NAMES[bad.weekday]}: closing time must be after opening time.` });
    setBusy(true);
    try {
      onSaved(await api.saveWeekly(weekly, limits));
      setDirty(false);
      setNote({ kind: "ok", text: "Availability saved. The booking calendar uses it right away." });
    } catch (e) {
      setNote({ kind: "error", text: errText(e, "Couldn't save. Please try again.") });
    } finally {
      setBusy(false);
    }
  };

  const customNotice = !NOTICE_OPTIONS.includes(limits.minimumNoticeDays);
  const customWindow = !WINDOW_OPTIONS.includes(limits.bookingWindowDays);
  const customBuffer = !BUFFER_OPTIONS.includes(limits.bufferMinutes);
  const customResched = !RESCHEDULE_OPTIONS.includes(limits.rescheduleNoticeHours);

  return (
    <div className={styles.availBlock}>
      <h3 className={cn(styles.h3, "chalk-soft")}>Weekly schedule</h3>
      <ul className={styles.weekList}>
        {DISPLAY_ORDER.map((wd) => {
          const d = weekly.find((x) => x.weekday === wd)!;
          const name = WEEKDAY_NAMES[wd];
          return (
            <li key={wd} className={cn(styles.weekRow, d.isOpen ? "" : styles.weekClosed)}>
              <span className={cn(styles.weekName, "chalk-soft")}>{name}</span>
              <label className={styles.toggle}>
                <input type="checkbox" checked={d.isOpen} onChange={(e) => setDay(wd, { isOpen: e.target.checked })} aria-label={`${name} open`} />
                <span className="chalk-soft">{d.isOpen ? "Open" : "Closed"}</span>
              </label>
              <span className={styles.weekTimes}>
                <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={d.start} disabled={!d.isOpen} onChange={(e) => setDay(wd, { start: e.target.value })} aria-label={`${name} opening time`} />
                <span className={cn(styles.muted, "chalk-soft")}>to</span>
                <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={d.end} disabled={!d.isOpen} onChange={(e) => setDay(wd, { end: e.target.value })} aria-label={`${name} closing time`} />
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className={cn(styles.h3, "chalk-soft")}>Booking rules</h3>
      <div className={styles.rulesGrid}>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="rule-notice">Minimum notice</label>
          <select
            id="rule-notice"
            className={styles.input}
            value={customNotice ? "custom" : String(limits.minimumNoticeDays)}
            onChange={(e) => setLimit({ minimumNoticeDays: e.target.value === "custom" ? 4 : Number(e.target.value) })}
          >
            <option value="0">Same day</option>
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="3">3 days</option>
            <option value="custom">Custom…</option>
          </select>
          {customNotice && (
            <input type="number" min={0} max={L.maxNoticeDays} className={styles.input} value={limits.minimumNoticeDays} onChange={(e) => setLimit({ minimumNoticeDays: Math.max(0, Math.min(L.maxNoticeDays, Number(e.target.value) || 0)) })} aria-label="Minimum notice in days" />
          )}
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="rule-window">Booking window</label>
          <select
            id="rule-window"
            className={styles.input}
            value={customWindow ? "custom" : String(limits.bookingWindowDays)}
            onChange={(e) => setLimit({ bookingWindowDays: e.target.value === "custom" ? 120 : Number(e.target.value) })}
          >
            {WINDOW_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} days ahead</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {customWindow && (
            <input type="number" min={1} max={L.maxWindowDays} className={styles.input} value={limits.bookingWindowDays} onChange={(e) => setLimit({ bookingWindowDays: Math.max(1, Math.min(L.maxWindowDays, Number(e.target.value) || 1)) })} aria-label="Booking window in days" />
          )}
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="rule-buffer">Buffer between sessions</label>
          <select
            id="rule-buffer"
            className={styles.input}
            value={customBuffer ? "custom" : String(limits.bufferMinutes)}
            onChange={(e) => setLimit({ bufferMinutes: e.target.value === "custom" ? 20 : Number(e.target.value) })}
          >
            {BUFFER_OPTIONS.map((n) => (
              <option key={n} value={n}>{n === 0 ? "No buffer" : `${n} minutes`}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {customBuffer && (
            <input type="number" min={0} max={L.maxBufferMinutes} step={5} className={styles.input} value={limits.bufferMinutes} onChange={(e) => setLimit({ bufferMinutes: Math.max(0, Math.min(L.maxBufferMinutes, Number(e.target.value) || 0)) })} aria-label="Buffer in minutes" />
          )}
          <p className={cn(styles.hintSmall, "chalk-soft")}>Kept free before and after every session, for travel and setup.</p>
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="rule-reschedule">Cancel &amp; reschedule notice</label>
          <select
            id="rule-reschedule"
            className={styles.input}
            value={customResched ? "custom" : String(limits.rescheduleNoticeHours)}
            onChange={(e) => setLimit({ rescheduleNoticeHours: e.target.value === "custom" ? 36 : Number(e.target.value) })}
          >
            {RESCHEDULE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} hours before</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {customResched && (
            <input type="number" min={1} max={L.maxRescheduleNoticeHours} className={styles.input} value={limits.rescheduleNoticeHours} onChange={(e) => setLimit({ rescheduleNoticeHours: Math.max(1, Math.min(L.maxRescheduleNoticeHours, Number(e.target.value) || 1)) })} aria-label="Cancel and reschedule notice in hours" />
          )}
          <p className={cn(styles.hintSmall, "chalk-soft")}>
            Families can cancel or move their session online until this long before it starts; after that they text you. Applies to new bookings
            (earlier ones keep the hours they were promised). Your Terms, the FAQ and the emails show this number automatically.
          </p>
        </div>
      </div>

      <div className={styles.photoBar}>
        {dirty && !busy ? <p className={cn(styles.unsaved, "chalk-soft")}>You have unsaved changes.</p> : <span />}
        <ChalkButton variant="solid" onClick={save} disabled={!dirty || busy} seed={880}>
          {busy ? "Saving…" : "Save changes"}
        </ChalkButton>
      </div>
      {note && (
        <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/* ---------------- special dates ---------------- */

function SpecialDates({ rules, api, onSaved }: { rules: AvailabilityRules; api: AdminApi; onSaved: (r: AvailabilityRules) => void }) {
  const today = todayInZone(bookingRules.timeZone);
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState(true);
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [impact, setImpact] = useState<ClosedDayImpact | null>(null);
  const [familyNote, setFamilyNote] = useState("");
  const [closeResult, setCloseResult] = useState<CloseDayResult | null>(null);

  const clearReview = () => {
    setImpact(null);
    setFamilyNote("");
    setCloseResult(null);
  };

  const reviewClosedDay = async (picked: string) => {
    setBusy(true);
    setNote(null);
    setCloseResult(null);
    try {
      const next = await api.closedDayImpact(picked);
      if (!next.bookings.length) {
        onSaved(await api.saveOverride({ date: picked, isClosed: true }));
        setNote({ kind: "ok", text: `${formatLongDate(picked)} is closed. There were no sessions to move.` });
        setDate("");
        clearReview();
      } else {
        setImpact(next);
      }
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't check that date.") });
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return setNote({ kind: "error", text: "Pick a date." });
    if (!closed && end <= start) return setNote({ kind: "error", text: "Closing time must be after opening time." });
    if (closed) {
      await reviewClosedDay(date);
      return;
    }
    setBusy(true);
    setNote(null);
    clearReview();
    try {
      onSaved(await api.saveOverride({ date, isClosed: false, start, end }));
      setNote({ kind: "ok", text: `${formatLongDate(date)} saved.` });
      setDate("");
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't save that date.") });
    } finally {
      setBusy(false);
    }
  };

  const closeAndNotify = async () => {
    if (!impact) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await api.closeDayAndNotify(impact.date, familyNote.trim() || undefined);
      onSaved(result.rules);
      setImpact(result.impact.bookings.length ? result.impact : null);
      setCloseResult(result);
      setDate("");
      const sent = result.sent.length;
      const already = result.alreadySent.length;
      const failed = result.failed.length;
      setNote(
        failed
          ? { kind: "error", text: `${formatLongDate(impact.date)} is closed. ${sent + already} ${sent + already === 1 ? "family was" : "families were"} emailed; ${failed} still ${failed === 1 ? "needs" : "need"} a text or another try.` }
          : { kind: "ok", text: `${formatLongDate(impact.date)} is closed. ${sent ? `${sent} ${sent === 1 ? "family" : "families"} emailed.` : "Everyone was already emailed."}` },
      );
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't close and notify. Refresh to check whether the date was saved.") });
    } finally {
      setBusy(false);
    }
  };

  const closeWithoutEmail = async () => {
    if (!impact) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await api.closeDayWithoutEmail(impact.date);
      onSaved(result.rules);
      setImpact(result.impact.bookings.length ? result.impact : null);
      setCloseResult(result);
      setNote(
        result.failed.length
          ? { kind: "error", text: `${formatLongDate(impact.date)} is closed, but ${result.failed.length} open deposit ${result.failed.length === 1 ? "page" : "pages"} could not be closed. Try again before contacting the family.` }
          : { kind: "ok", text: `${formatLongDate(impact.date)} is closed. The listed families were not emailed; any open deposit pages were closed.` },
      );
      setDate("");
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't close that date.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    setBusy(true);
    try {
      onSaved(await api.deleteOverride(d));
      if (impact?.date === d) clearReview();
      setNote({ kind: "ok", text: `${formatLongDate(d)} is back to the weekly schedule.` });
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't delete that date.") });
    } finally {
      setBusy(false);
    }
  };

  const upcoming = rules.overrides.filter((o) => o.date >= today);

  return (
    <div className={styles.availBlock}>
      <h3 className={cn(styles.h3, "chalk-soft")}>Special dates</h3>
      <p className={cn(styles.muted, "chalk-soft")}>Close a whole day, or give one date different hours. These replace the weekly schedule for that day.</p>
      <form onSubmit={add} className={styles.availForm} noValidate>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="sd-date">Date</label>
          <input id="sd-date" type="date" min={today} className={cn(styles.input, styles.timeInput)} value={date} onChange={(e) => { setDate(e.target.value); clearReview(); setNote(null); }} />
        </div>
        <label className={cn(styles.toggle, styles.formToggle)}>
          <input type="checkbox" checked={closed} onChange={(e) => { setClosed(e.target.checked); clearReview(); setNote(null); }} />
          <span className="chalk-soft">Closed all day</span>
        </label>
        <div className={styles.ruleField}>
          <span className={cn(styles.label, "chalk-soft")}>Custom hours</span>
          <span className={styles.weekTimes}>
            <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={start} disabled={closed} onChange={(e) => setStart(e.target.value)} aria-label="Special date opening time" />
            <span className={cn(styles.muted, "chalk-soft")}>to</span>
            <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={end} disabled={closed} onChange={(e) => setEnd(e.target.value)} aria-label="Special date closing time" />
          </span>
        </div>
        <ChalkButton type="submit" variant="outline" disabled={busy} seed={881}>Save date</ChalkButton>
      </form>
      {note && (
        <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {impact && (
        <ClosedDayReview
          impact={impact}
          familyNote={familyNote}
          result={closeResult}
          busy={busy}
          onNote={setFamilyNote}
          onNotify={closeAndNotify}
          onCloseOnly={closeWithoutEmail}
          onDismiss={clearReview}
        />
      )}
      {upcoming.length > 0 ? (
        <ul className={styles.overrideList} aria-label="Upcoming special dates">
          {upcoming.map((o) => (
            <li key={o.date} className={styles.overrideRow}>
              <span className="chalk-soft">
                <b>{formatLongDate(o.date)}</b> — {o.isClosed ? "Closed" : `${formatTimeLabel(o.start!)} – ${formatTimeLabel(o.end!)}`}
              </span>
              <span className={styles.overrideActions}>
                {o.isClosed && (
                  <button type="button" className={styles.smallButton} onClick={() => reviewClosedDay(o.date)} disabled={busy}>
                    Check sessions
                  </button>
                )}
                <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => remove(o.date)} disabled={busy} aria-label={`Delete special date ${formatLongDate(o.date)}`}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(styles.hintSmall, "chalk-soft")}>No special dates yet.</p>
      )}
    </div>
  );
}

function ClosedDayReview({
  impact,
  familyNote,
  result,
  busy,
  onNote,
  onNotify,
  onCloseOnly,
  onDismiss,
}: {
  impact: ClosedDayImpact;
  familyNote: string;
  result: CloseDayResult | null;
  busy: boolean;
  onNote: (value: string) => void;
  onNotify: () => void;
  onCloseOnly: () => void;
  onDismiss: () => void;
}) {
  const needsEmailCount = impact.bookings.filter((booking) => booking.notification?.status !== "sent").length;
  const needsEmail = needsEmailCount > 0;
  return (
    <section className={styles.closeDayReview} aria-labelledby="close-day-review-title">
      <div>
        <h4 id="close-day-review-title" className={cn(styles.closeDayTitle, "chalk-soft")}>
          {impact.bookings.length} {impact.bookings.length === 1 ? "family" : "families"} affected on {formatLongDate(impact.date)}
        </h4>
        <p className={cn(styles.hintSmall, "chalk-soft")}>
          Closing the day stops new bookings. Emailing sends each family a private link to choose another open time, even inside the usual notice window.
        </p>
      </div>
      <ul className={styles.closeDayList}>
        {impact.bookings.map((booking) => (
          <li key={booking.reference} className={styles.closeDayFamily}>
            <span>
              <b>{booking.parentName}</b>
              <span className={styles.closeDayMeta}>{formatTimeLabel(booking.start)} – {formatTimeLabel(booking.end)} · {booking.reference}</span>
            </span>
            <span className={styles.closeDayContact}>
              <a href={`mailto:${booking.email}`}>{booking.email}</a>
              <a href={`sms:${booking.phone}`}>{booking.phone}</a>
            </span>
            <span className={cn(styles.closeDayStatus, booking.notification?.status === "sent" ? styles.closeDaySent : booking.notification?.status === "failed" ? styles.closeDayFailed : "")}>
              {booking.notification?.status === "sent"
                ? "Email sent — waiting for a new time"
                : booking.notification?.status === "failed"
                  ? "Email failed — retry or text"
                  : booking.status === "pending"
                    ? "Deposit page still open"
                    : booking.status === "cancelled"
                      ? "Payment page closed — needs email"
                    : "Needs schedule-change email"}
            </span>
          </li>
        ))}
      </ul>
      {result?.failed.length ? (
        <p className={cn(styles.closeDayFailure, "chalk-soft")} role="alert">
          Couldn&apos;t email: {result.failed.map((item) => item.reference).join(", ")}. The day is closed; retry or use the contact links above.
        </p>
      ) : null}
      {needsEmail && (
        <label className={styles.ruleField}>
          <span className={cn(styles.label, "chalk-soft")}>Note for every family <span className={styles.optional}>(optional)</span></span>
          <textarea
            className={cn(styles.input, styles.closeDayNote)}
            maxLength={500}
            value={familyNote}
            onChange={(e) => onNote(e.target.value)}
            placeholder="A short personal explanation, if you want to add one"
          />
        </label>
      )}
      <div className={styles.closeDayActions}>
        {needsEmail && (
          <ChalkButton variant="solid" onClick={onNotify} disabled={busy} seed={883}>
            {busy ? "Closing…" : `Close day + email ${needsEmailCount} ${needsEmailCount === 1 ? "family" : "families"}`}
          </ChalkButton>
        )}
        {needsEmail && (
          <button type="button" className={styles.smallButton} onClick={onCloseOnly} disabled={busy}>
            Close without emailing
          </button>
        )}
        <button type="button" className={styles.linkButton} onClick={onDismiss} disabled={busy}>Dismiss</button>
      </div>
    </section>
  );
}

/* ---------------- manual time blocks ---------------- */

function TimeBlocks({ rules, api, onSaved }: { rules: AvailabilityRules; api: AdminApi; onSaved: (r: AvailabilityRules) => void }) {
  const today = todayInZone(bookingRules.timeZone);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("16:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return setNote({ kind: "error", text: "Pick a date." });
    if (end <= start) return setNote({ kind: "error", text: "The end time must be after the start time." });
    setBusy(true);
    setNote(null);
    try {
      onSaved(await api.addBlock({ date, start, end, reason: reason.trim() || undefined }));
      setNote({ kind: "ok", text: `Blocked ${formatLongDate(date)}, ${formatTimeLabel(start)} – ${formatTimeLabel(end)}.` });
      setDate("");
      setReason("");
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't block that time.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      onSaved(await api.deleteBlock(id));
      setNote({ kind: "ok", text: "Time block removed." });
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't remove that block.") });
    } finally {
      setBusy(false);
    }
  };

  const upcoming = rules.blocks.filter((b) => b.date >= today);

  return (
    <div className={styles.availBlock}>
      <h3 className={cn(styles.h3, "chalk-soft")}>Time blocks</h3>
      <p className={cn(styles.muted, "chalk-soft")}>Block part of a day, like a personal appointment. Families can&apos;t book anything that overlaps it (including the buffer).</p>
      <form onSubmit={add} className={styles.availForm} noValidate>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tb-date">Date</label>
          <input id="tb-date" type="date" min={today} className={cn(styles.input, styles.timeInput)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={styles.ruleField}>
          <span className={cn(styles.label, "chalk-soft")}>Time</span>
          <span className={styles.weekTimes}>
            <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={start} onChange={(e) => setStart(e.target.value)} aria-label="Block start time" />
            <span className={cn(styles.muted, "chalk-soft")}>to</span>
            <input type="time" step={900} className={cn(styles.input, styles.timeInput)} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Block end time" />
          </span>
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tb-reason">Reason <span className={styles.optional}>(optional, only you see it)</span></label>
          <input id="tb-reason" className={styles.input} maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Personal appointment" />
        </div>
        <ChalkButton type="submit" variant="outline" disabled={busy} seed={882}>Block this time</ChalkButton>
      </form>
      {note && (
        <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {upcoming.length > 0 ? (
        <ul className={styles.overrideList} aria-label="Upcoming time blocks">
          {upcoming.map((b) => (
            <li key={b.id} className={styles.overrideRow}>
              <span className="chalk-soft">
                <b>{formatLongDate(b.date)}</b> — {formatTimeLabel(b.start)} – {formatTimeLabel(b.end)}
                {b.reason ? <span className={styles.blockReason}> · {b.reason}</span> : null}
              </span>
              <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => remove(b.id)} disabled={busy} aria-label={`Delete time block on ${formatLongDate(b.date)}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(styles.hintSmall, "chalk-soft")}>No time blocks yet.</p>
      )}
    </div>
  );
}

/* ---------------- travel fee ---------------- */

const exampleLine = (e: TravelExample) =>
  e.status === "too_far" ? `about ${e.miles} miles: too far to book online` : e.status === "fee" ? `about ${e.miles} miles → ${formatMoney(e.feeCents)}` : e.miles === null ? "distance unknown" : `about ${e.miles} miles → no fee`;

function TravelFees({ api }: { api: AdminApi }) {
  const [saved, setSaved] = useState<TravelSettings | null>(null);
  const [examples, setExamples] = useState<TravelExample[]>([]);
  const [form, setForm] = useState({ baseZip: "", freeMiles: "", perMile: "", maxMiles: "" });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    api
      .getTravel()
      .then((r) => {
        setSaved(r.settings);
        setExamples(r.examples);
        if (r.settings) setForm({ baseZip: r.settings.baseZip, freeMiles: String(r.settings.freeMiles), perMile: (r.settings.perMileCents / 100).toFixed(2), maxMiles: String(r.settings.maxMiles) });
      })
      .catch((e) => setNote({ kind: "error", text: errText(e, "Couldn't load the travel settings.") }))
      .finally(() => setLoaded(true));
  }, [api]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setNote(null);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = { freeMiles: Number(form.freeMiles), perMileCents: Math.round(Number(form.perMile) * 100), maxMiles: Number(form.maxMiles) };
    if (!/^\d{5}$/.test(form.baseZip.trim())) return setNote({ kind: "error", text: "Enter your home-base ZIP code (5 digits)." });
    if ([form.freeMiles, form.perMile, form.maxMiles].some((v) => v.trim() === "") || Object.values(n).some((v) => !Number.isFinite(v) || v < 0)) {
      return setNote({ kind: "error", text: "Fill in free miles, price per mile and the farthest distance." });
    }
    setBusy(true);
    try {
      const r = await api.saveTravel({ baseZip: form.baseZip.trim(), ...n });
      setSaved(r.settings);
      setExamples(r.examples);
      setNote({ kind: "ok", text: "Travel fee saved. New bookings, the FAQ and the Terms use it right away." });
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't save. Please try again.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.availBlock}>
      <h3 className={cn(styles.h3, "chalk-soft")}>Travel fee</h3>
      <p className={cn(styles.muted, "chalk-soft")}>
        Families see the fee under the ZIP code box as soon as they type it, and it&apos;s added to their total (paid with the session). Distances are
        estimated from ZIP codes (about ±10%). Homes farther than the last number can&apos;t book online: they&apos;re asked to text you.
      </p>
      {loaded && !saved && <p className={cn(styles.bannerError, "chalk-soft")}>Travel fees are off until you save these.</p>}
      <form onSubmit={save} className={styles.availForm} noValidate>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tf-zip">Home base ZIP code</label>
          <input id="tf-zip" className={cn(styles.input, styles.timeInput)} inputMode="numeric" maxLength={5} value={form.baseZip} onChange={(e) => set("baseZip", e.target.value)} placeholder="e.g. 33139" />
          <p className={cn(styles.hintSmall, "chalk-soft")}>Only you see it. Distances are measured from here.</p>
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tf-free">Free miles</label>
          <input id="tf-free" className={cn(styles.input, styles.timeInput)} type="number" min={0} max={500} value={form.freeMiles} onChange={(e) => set("freeMiles", e.target.value)} placeholder="e.g. 30" />
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tf-price">Price per extra mile ($)</label>
          <input id="tf-price" className={cn(styles.input, styles.timeInput)} type="number" min={0} max={10} step={0.05} value={form.perMile} onChange={(e) => set("perMile", e.target.value)} placeholder="e.g. 0.75" />
        </div>
        <div className={styles.ruleField}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="tf-max">Farthest for online booking (miles)</label>
          <input id="tf-max" className={cn(styles.input, styles.timeInput)} type="number" min={1} max={1000} value={form.maxMiles} onChange={(e) => set("maxMiles", e.target.value)} placeholder="e.g. 250" />
        </div>
        <ChalkButton type="submit" variant="outline" disabled={busy} seed={884}>
          {busy ? "Saving…" : "Save travel fee"}
        </ChalkButton>
      </form>
      {note && (
        <p className={cn(note.kind === "ok" ? styles.ok : styles.error, "chalk-soft")} role={note.kind === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {examples.length > 0 && (
        <ul className={styles.overrideList} aria-label="Example travel fees">
          {examples.map((e) => (
            <li key={e.place} className={styles.overrideRow}>
              <span className="chalk-soft">
                <b>{e.place}</b> — {exampleLine(e)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
