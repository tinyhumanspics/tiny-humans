"use client";

import { useEffect, useState, type FormEvent } from "react";
import { bookingRules } from "@/config/booking";
import type { AdminApi } from "@/lib/admin/client";
import type { AvailabilityRules, BookingLimits, WeeklyDay } from "@/lib/availability/types";
import { WEEKDAY_NAMES } from "@/lib/availability/types";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
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

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) return setNote({ kind: "error", text: "Pick a date." });
    if (!closed && end <= start) return setNote({ kind: "error", text: "Closing time must be after opening time." });
    setBusy(true);
    setNote(null);
    try {
      onSaved(await api.saveOverride(closed ? { date, isClosed: true } : { date, isClosed: false, start, end }));
      setNote({ kind: "ok", text: `${formatLongDate(date)} saved.` });
      setDate("");
    } catch (err) {
      setNote({ kind: "error", text: errText(err, "Couldn't save that date.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: string) => {
    setBusy(true);
    try {
      onSaved(await api.deleteOverride(d));
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
          <input id="sd-date" type="date" min={today} className={cn(styles.input, styles.timeInput)} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className={cn(styles.toggle, styles.formToggle)}>
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
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
      {upcoming.length > 0 ? (
        <ul className={styles.overrideList} aria-label="Upcoming special dates">
          {upcoming.map((o) => (
            <li key={o.date} className={styles.overrideRow}>
              <span className="chalk-soft">
                <b>{formatLongDate(o.date)}</b> — {o.isClosed ? "Closed" : `${formatTimeLabel(o.start!)} – ${formatTimeLabel(o.end!)}`}
              </span>
              <button type="button" className={cn(styles.smallButton, styles.danger)} onClick={() => remove(o.date)} disabled={busy} aria-label={`Delete special date ${formatLongDate(o.date)}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(styles.hintSmall, "chalk-soft")}>No special dates yet.</p>
      )}
    </div>
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
