"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dashboard, DashboardSession, DashboardShare, DashboardWeek } from "@/lib/admin/dashboard-types";
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
const monthDay = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

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

/* ---------------- bookings and booked revenue by week ---------------- */

const BAR_W = 28;
const CHART_H = 120;

export function WeeklyChart({ weeks }: { weeks: DashboardWeek[] }) {
  const [mode, setMode] = useState<"bookings" | "revenue">("bookings");
  const value = (w: DashboardWeek) => (mode === "bookings" ? w.bookings : w.revenueCents);
  const label = (w: DashboardWeek) => (mode === "bookings" ? String(w.bookings) : shortDollars(w.revenueCents));
  const max = Math.max(1, ...weeks.map(value));
  const totalBookings = weeks.reduce((n, w) => n + w.bookings, 0);
  const totalCents = weeks.reduce((n, w) => n + w.revenueCents, 0);
  const width = weeks.length * BAR_W;
  return (
    <section className={styles.block} aria-labelledby="dash-weeks">
      <h2 id="dash-weeks" className={cn(admin.h3, "chalk")}>Bookings by week</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>
        Last {weeks.length} weeks: {totalBookings} {totalBookings === 1 ? "booking" : "bookings"} · {dollars(totalCents)} booked. Bookings made each
        week that are still on.
      </p>
      <div className={styles.toggle} role="group" aria-label="Show">
        {(["bookings", "revenue"] as const).map((m) => (
          <button key={m} type="button" className={cn(styles.toggleButton, "chalk-soft")} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "bookings" ? "Bookings" : "Booked total"}
          </button>
        ))}
      </div>
      <figure className={styles.chart}>
        <svg viewBox={`0 0 ${width} ${CHART_H + 34}`} className={styles.chartSvg} aria-hidden="true">
          {weeks.map((w, i) => {
            const v = value(w);
            const h = v ? Math.max(14, Math.round((v / max) * (CHART_H - 18))) : 0;
            const x = i * BAR_W;
            return (
              <g key={w.weekStart}>
                {h > 0 && (
                  <>
                    <path className={cn(styles.bar, i === weeks.length - 1 && styles.barNow, "chalk-grain")} transform={`translate(${x} ${CHART_H - h})`} d={roughRectPath(BAR_W, h + 4, 700 + i, 1.6, 4)} />
                    <text className={styles.barValue} x={x + BAR_W / 2} y={CHART_H - h - 4} textAnchor="middle">{label(w)}</text>
                  </>
                )}
                {i % 2 === (weeks.length - 1) % 2 && (
                  <text className={styles.axisLabel} x={x + BAR_W / 2} y={CHART_H + 22} textAnchor="middle">{i === weeks.length - 1 ? "now" : monthDay(w.weekStart)}</text>
                )}
              </g>
            );
          })}
          <path className={styles.baseline} d={`M2 ${CHART_H + 1} Q${width / 2} ${CHART_H + 3} ${width - 2} ${CHART_H}`} />
        </svg>
        <figcaption className="visually-hidden">
          <table>
            <thead><tr><th>Week of</th><th>Bookings</th><th>Booked total</th></tr></thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekStart}><td>{formatLongDate(w.weekStart)}</td><td>{w.bookings}</td><td>{dollars(w.revenueCents)}</td></tr>
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
        <p className={cn(styles.empty, "chalk-soft")}>No bookings yet in these weeks.</p>
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

export function ChangesAndEmails({ data, weeks }: { data: Dashboard; weeks: number }) {
  const tile = (n: number, label: string, warn = false) => (
    <div className={cn(admin.stat, warn && n > 0 && styles.statWarn)}>
      <span className={cn(admin.statNum, "chalk")}>{n}</span>
      <span className="chalk-soft">{label}</span>
    </div>
  );
  return (
    <section className={styles.block} aria-labelledby="dash-changes">
      <h2 id="dash-changes" className={cn(admin.h3, "chalk")}>Changes and emails</h2>
      <p className={cn(admin.hintSmall, "chalk-soft")}>Changes over the last {weeks} weeks; emails over the last {data.emails.days} days.</p>
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
  return (
    <div className={styles.insights}>
      <WeeklyChart weeks={data.weeks} />
      <ShareBars id="dash-bundles" title="By bundle" hint={`Bookings still on, made in the last ${data.weeks.length} weeks.`} items={data.bundles} />
      <ShareBars id="dash-sources" title="Where bookings come from" hint="Same bookings, by how the family first found the website." items={data.sources} />
    </div>
  );
}
