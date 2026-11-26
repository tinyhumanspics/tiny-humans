"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { bucketKey, bucketLabel, daysBetween, isWholeMonth, MAX_PERIOD_DAYS, monthOf, periodLabel, shiftMonth, type DashboardPeriod } from "@/lib/admin/dashboard-period";
import type { Dashboard, DashboardBucket, DashboardSession, DashboardShare } from "@/lib/admin/dashboard-types";
import { addDaysKey } from "@/lib/booking/timezone";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { roughRectPath } from "@/lib/chalk/rough";
import admin from "./Admin.module.css";
import styles from "./Dashboard.module.css";
import { cn } from "@/lib/cn";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** "$1,317.20" ("$249" when there are no cents). */
const dollars = (cents: number) => usd.format(cents / 100).replace(/\.00$/, "");
/** Short label above a bar, so neighbors never overlap: "$423", "$1.3k". */
const shortDollars = (cents: number) => (cents >= 100_000 ? `$${(cents / 100_000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(cents / 100)}`);

/* ---------------- sessions coming up (today + 6 days) ---------------- */

export function ComingUp({ data }: { data: Dashboard }) {
  const days = new Map<string, DashboardSession[]>();
  for (const s of data.upcoming) days.set(s.date, [...(days.get(s.date) ?? []), s]);
  const dayLabel = (key: string) => (key === data.today ? "Today" : key === addDaysKey(data.today, 1) ? "Tomorrow" : formatLongDate(key));
  return (
    <section className={styles.block} aria-labelledby="dash-upcoming">
      <h2 id="dash-upcoming" className={cn(admin.h3, "chalk")}>Coming up</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>Sessions today and the next 6 days (Miami time).</p>
      {days.size === 0 ? (
        <p className={cn(styles.empty, "chalk-soft")}>No sessions in the next 7 days.</p>
      ) : (
        [...days].map(([day, sessions]) => (
          <div key={day} className={styles.day}>
            <h3 className={cn(styles.dayTitle, "chalk-soft")}>{dayLabel(day)}</h3>
            <ul className={styles.sessions}>
              {sessions.map((s) => (
                <li key={s.reference} className={styles.session}>
                  <span className={cn(styles.sessionTime, "chalk")}>
                    {formatTimeLabel(s.start)} – {formatTimeLabel(s.end)}
                  </span>
                  <span className={cn(styles.sessionWho, "chalk-soft")}>
                    {s.parentName} · {s.bundleName}
                    {s.status !== "confirmed" && <span className={styles.tag}>{s.status === "pending" ? "Waiting for deposit" : "Rescheduled"}</span>}
                  </span>
                  <span className={cn(styles.sessionWhere, "chalk-soft")}>{s.location}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Link href="/admin/leads" className={cn(styles.more, "chalk-soft")}>See all bookings</Link>
    </section>
  );
}

/* ---------------- the period: picker and totals ---------------- */

const shortDate = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
/** "October"; "October 2025" when it isn't this year. */
const monthName = (key: string, today: string) => shortDate(key, key.slice(0, 4) === today.slice(0, 4) ? { month: "long" } : { month: "long", year: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How the tiles name the period: "this month", "in October", "in these dates". */
function periodWords(data: Dashboard) {
  const thisMonth = monthOf(data.today);
  const isThisMonth = data.period.from === thisMonth.from && data.period.to === thisMonth.to;
  return { isThisMonth, whole: isWholeMonth(data.period), when: isThisMonth ? "this month" : isWholeMonth(data.period) ? `in ${monthName(data.period.from, data.today)}` : "in these dates" };
}

/**
 * The dates the numbers cover (owner, Nov 25): this month when the dashboard opens, the month before or after with the
 * arrows, or any dates. `onPick(null)` goes back to this month.
 */
export function PeriodNumbers({ data, busy, error, onPick }: { data: Dashboard; busy: boolean; error: string | null; onPick: (period: DashboardPeriod | null) => void }) {
  const [picking, setPicking] = useState(false);
  const [from, setFrom] = useState(data.period.from);
  const [to, setTo] = useState(data.period.to);
  const [formError, setFormError] = useState<string | null>(null);
  const { isThisMonth, whole, when } = periodWords(data);
  const prev = shiftMonth(data.period.from, -1);
  const next = shiftMonth(data.period.from, 1);
  const t = data.totals;
  const show = (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setFormError("Pick a start and an end date.");
    if (to < from) return setFormError("The end date is before the start date.");
    if (daysBetween(from, to) + 1 > MAX_PERIOD_DAYS) return setFormError("Pick up to 2 years at a time.");
    setFormError(null);
    setPicking(false);
    onPick({ from, to });
  };
  const openPicker = () => {
    setFrom(data.period.from);
    setTo(data.period.to);
    setFormError(null);
    setPicking((p) => !p);
  };
  const tile = (value: string, label: string, sub: string) => (
    <div className={admin.stat}>
      <span className={cn(admin.statNum, "chalk")}>{value}</span>
      <span className="chalk-soft">{label}</span>
      <span className={cn(styles.statSub, "chalk-soft")}>{sub}</span>
    </div>
  );
  const parts = [
    t.paid.depositCents ? `${dollars(t.paid.depositCents)} deposits` : null,
    t.paid.sessionCents ? `${dollars(t.paid.sessionCents)} session payments` : null,
    t.paid.extrasCents ? `${dollars(t.paid.extrasCents)} photo extras (${plural(t.paid.extrasOrders, "order")})` : null,
  ].filter(Boolean);
  return (
    <section className={styles.block} aria-labelledby="dash-period" aria-busy={busy}>
      <h2 id="dash-period" className={cn(admin.h3, "chalk")}>{periodLabel(data.period)}</h2>
      <div className={styles.periodBar}>
        {whole && (
          <>
            <button type="button" className={admin.smallButton} onClick={() => onPick(prev)} aria-label={`Previous month: ${periodLabel(prev)}`}>
              ‹ {shortDate(prev.from, { month: "short" })}
            </button>
            <button type="button" className={admin.smallButton} onClick={() => onPick(next)} disabled={next.from > data.today} aria-label={`Next month: ${periodLabel(next)}`}>
              {shortDate(next.from, { month: "short" })} ›
            </button>
          </>
        )}
        {!isThisMonth && (
          <button type="button" className={admin.smallButton} onClick={() => onPick(null)}>
            This month
          </button>
        )}
        <button type="button" className={cn(admin.smallButton, picking && admin.smallButtonOn)} aria-expanded={picking} aria-controls="dash-dates" onClick={openPicker}>
          Pick dates
        </button>
      </div>
      {picking && (
        <form id="dash-dates" className={styles.dates} onSubmit={show} noValidate>
          <label className={styles.dateField}>
            <span className={admin.label}>From</span>
            <input className={admin.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={Boolean(formError) && !from} />
          </label>
          <label className={styles.dateField}>
            <span className={admin.label}>To</span>
            <input className={admin.input} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-invalid={Boolean(formError) && (!to || to < from)} />
          </label>
          <button type="submit" className={admin.smallButton}>Show</button>
          {formError && <p className={admin.error} role="alert">{formError}</p>}
        </form>
      )}
      <p className={cn(admin.hintSmall, "chalk-soft")} aria-live="polite">
        {busy ? "Loading…" : isThisMonth ? `Month so far, through today (${shortDate(data.today, { month: "short", day: "numeric" })}). Miami time.` : "Miami time."}
      </p>
      {error && <p className={admin.error} role="alert">{error}</p>}
      <div className={cn(admin.stats, styles.periodStats, busy && styles.loading)}>
        {tile(dollars(t.paidCents), `Paid ${when}`, "Deposits, session payments and photo extras")}
        {tile(dollars(t.bookedCents), `Booked ${when}`, `Full price of ${plural(t.bookings, "session")} booked`)}
        {tile(String(t.leads), "New leads", t.leads ? `${t.leadsBooked} booked · ${t.leadsWaiting} waiting for you` : "Families who sent a request")}
        {tile(String(t.bookings), "Sessions booked", "Still on (not cancelled)")}
      </div>
      <p className={cn(admin.hintSmall, "chalk-soft")}>
        {parts.length ? `Paid: ${parts.join(" · ")}.` : `Nothing paid ${when}.`} New leads: families who sent a request on the website or from your booking link (each family
        once); booked = they paid the deposit.
      </p>
    </section>
  );
}

/* ---------------- the period by day, week or month ---------------- */

type ChartMode = "paid" | "booked" | "leads" | "sessions";
const MODES: { id: ChartMode; label: string; hint: (unit: string) => string }[] = [
  { id: "paid", label: "Paid", hint: (u) => `Money that came in each ${u}.` },
  { id: "booked", label: "Booked", hint: (u) => `Full price of the sessions booked each ${u}.` },
  { id: "leads", label: "Leads", hint: (u) => `New leads each ${u} (each family once).` },
  { id: "sessions", label: "Sessions", hint: (u) => `Sessions booked each ${u}, still on.` },
];
const CHART_H = 120;
/** Rough width of one character of the chalk labels (11 px), to keep labels from overlapping. */
const CHAR_W = 5.6;
/** Room left and right of the bars, so the first and last labels aren't cut. */
const PAD = 14;

export function PeriodChart({ data }: { data: Dashboard }) {
  const [mode, setMode] = useState<ChartMode>("paid");
  const { buckets, period, today } = data;
  const unit = period.unit;
  const money = mode === "paid" || mode === "booked";
  const value = (b: DashboardBucket) => (mode === "paid" ? b.paidCents : mode === "booked" ? b.bookedCents : mode === "leads" ? b.leads : b.bookings);
  const text = (v: number) => (money ? shortDollars(v) : String(v));
  const n = buckets.length;
  const slot = n <= 6 ? 48 : n <= 12 ? 28 : n <= 26 ? 16 : 12;
  const width = n * slot;
  const max = Math.max(1, ...buckets.map(value));
  const now = bucketKey(today, unit);
  // value labels: biggest bars first, skipping any that would overlap one already placed
  const placed: [number, number][] = [];
  const labelled = new Set<number>();
  for (const i of buckets.map((_, i) => i).filter((i) => value(buckets[i]) > 0).sort((a, b) => value(buckets[b]) - value(buckets[a]))) {
    const half = (text(value(buckets[i])).length * CHAR_W) / 2;
    const c = i * slot + slot / 2;
    if (placed.some(([l, r]) => c - half < r + 2 && c + half > l - 2)) continue;
    placed.push([c - half, c + half]);
    labelled.add(i);
  }
  const axis = buckets.map((b, i) => bucketLabel(b.start, unit, i === 0));
  const step = Math.max(1, Math.ceil((Math.max(...axis.map((a) => a.length)) * CHAR_W + 6) / slot));
  const title = unit === "day" ? "By day" : unit === "week" ? "By week" : "By month";
  const current = MODES.find((m) => m.id === mode)!;
  return (
    <section className={styles.block} aria-labelledby="dash-chart">
      <h2 id="dash-chart" className={cn(admin.h3, "chalk")}>{title}</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>{current.hint(unit)}</p>
      <div className={styles.toggle} role="group" aria-label="Show">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={cn(styles.toggleButton, "chalk-soft")} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <figure className={styles.chart}>
        <svg viewBox={`${-PAD} 0 ${width + 2 * PAD} ${CHART_H + 34}`} className={styles.chartSvg} style={{ maxWidth: (width + 2 * PAD) * 1.5 }} aria-hidden="true">
          {buckets.map((b, i) => {
            const v = value(b);
            const h = v ? Math.max(10, Math.round((v / max) * (CHART_H - 18))) : 0;
            const x = i * slot;
            return (
              <g key={b.start}>
                <title>{`${bucketLabel(b.start, unit, true)}: ${money ? dollars(v) : v}`}</title>
                {h > 0 && <path className={cn(styles.bar, b.start === now && styles.barNow, "chalk-grain")} transform={`translate(${x} ${CHART_H - h})`} d={roughRectPath(slot, h + 4, 700 + i, slot < 20 ? 1 : 1.6, slot < 20 ? 2 : 4)} />}
                {labelled.has(i) && <text className={styles.barValue} x={x + slot / 2} y={CHART_H - h - 4} textAnchor="middle">{text(v)}</text>}
                {i % step === 0 && <text className={styles.axisLabel} x={x + slot / 2} y={CHART_H + 22} textAnchor="middle">{axis[i]}</text>}
              </g>
            );
          })}
          <path className={styles.baseline} d={`M2 ${CHART_H + 1} Q${width / 2} ${CHART_H + 3} ${width - 2} ${CHART_H}`} />
        </svg>
        <figcaption className="visually-hidden">
          <table>
            <thead><tr><th>{unit === "day" ? "Day" : unit === "week" ? "Week of" : "Month"}</th><th>Paid</th><th>Booked</th><th>Leads</th><th>Sessions</th></tr></thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.start}><td>{unit === "month" ? shortDate(b.start, { month: "long", year: "numeric" }) : formatLongDate(b.start)}</td><td>{dollars(b.paidCents)}</td><td>{dollars(b.bookedCents)}</td><td>{b.leads}</td><td>{b.bookings}</td></tr>
              ))}
            </tbody>
          </table>
        </figcaption>
      </figure>
    </section>
  );
}

/* ---------------- shares by bundle / by source ---------------- */

export function ShareBars({ id, title, hint, items }: { id: string; title: string; hint: string; items: DashboardShare[] }) {
  const max = Math.max(1, ...items.map((i) => i.bookings));
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={cn(admin.h3, "chalk")}>{title}</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>{hint}</p>
      {items.length === 0 ? (
        <p className={cn(styles.empty, "chalk-soft")}>No sessions booked in these dates.</p>
      ) : (
        <ul className={styles.shares}>
          {items.map((item) => (
            <li key={item.label} className={styles.share}>
              <span className={cn(styles.shareLabel, "chalk-soft")}>{item.label}</span>
              <span className={styles.shareTrack} aria-hidden="true">
                <span className={cn(styles.shareFill, "chalk-grain")} style={{ width: `${Math.max(6, (item.bookings / max) * 100)}%` }} />
              </span>
              <span className={cn(styles.shareValue, "chalk-soft")}>
                {item.bookings} · {dollars(item.revenueCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- changes and emails ---------------- */

export function ChangesAndEmails({ data }: { data: Dashboard }) {
  const tile = (n: number, label: string, warn = false) => (
    <div className={cn(admin.stat, warn && n > 0 && styles.statWarn)}>
      <span className={cn(admin.statNum, "chalk")}>{n}</span>
      <span className="chalk-soft">{label}</span>
    </div>
  );
  return (
    <section className={styles.block} aria-labelledby="dash-changes">
      <h2 id="dash-changes" className={cn(admin.h3, "chalk")}>Changes and emails</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>{periodWords(data).isThisMonth ? "This month." : `${periodLabel(data.period)}.`}</p>
      <div className={admin.stats}>
        {tile(data.changes.cancelled, "Cancelled")}
        {tile(data.changes.rescheduled, "Rescheduled")}
        {tile(data.changes.depositNotPaid, "Deposit not paid (time released)")}
        {tile(data.emails.sent, "Reminder emails sent")}
        {tile(data.emails.failed, "Emails that failed", true)}
        {tile(data.emails.problems, "Delivery problems (bounced, spam)", true)}
      </div>
    </section>
  );
}

/* ---------------- the charts together (side by side on wide screens) ---------------- */

export function DashboardCharts({ data }: { data: Dashboard }) {
  const { isThisMonth } = periodWords(data);
  const booked = isThisMonth ? "this month" : `in ${periodLabel(data.period)}`;
  return (
    <div className={styles.insights}>
      <PeriodChart data={data} />
      <ShareBars id="dash-bundles" title="By bundle" hint={`Sessions booked ${booked}, still on.`} items={data.bundles} />
      <ShareBars id="dash-sources" title="Where bookings come from" hint="Same sessions, by how the family first found the website." items={data.sources} />
    </div>
  );
}
