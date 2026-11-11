"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "@/features/admin/Admin.module.css";
import { cn } from "@/lib/cn";
import { addDaysKey } from "@/lib/booking/timezone";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import { clock, dayParts, inspoCounts, plural, todayMiami, tomorrowMiami } from "@/lib/shoots/format";
import type { ShootDay } from "@/lib/shoots/types";
import NotReady from "./NotReady";
import ShootsTabs from "./ShootsTabs";
import css from "./Shoots.module.css";

/** How far back "Done" goes and how far ahead "Coming up" looks (one request, under the API's 400-day limit). */
const PAST_DAYS = 60;
const AHEAD_DAYS = 330;

/** /admin/shoots: every shoot day (coming up, then done) and "+ Shoot without a booking". */
export default function ShootsList() {
  const [days, setDays] = useState<ShootDay[] | null>(null);
  const [error, setError] = useState<ShootsApiError | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const today = todayMiami();

  useEffect(() => {
    const from = addDaysKey(today, -PAST_DAYS);
    shootsApi
      .days(from, addDaysKey(today, AHEAD_DAYS))
      .then(setDays)
      .catch((e: ShootsApiError) => setError(e));
  }, [today]);

  const upcoming = days?.filter((d) => d.date >= today) ?? [];
  const done = (days?.filter((d) => d.date < today) ?? []).reverse();

  return (
    <div>
      <div className={css.top}>
        <p className={cn(styles.muted, "chalk-soft")}>
          Every booking gets a shoot folder. Drop in the family&apos;s inspo and your own BTS ideas, then tick them off on the day sheet.
        </p>
        <button type="button" className={cn(styles.addButton, css.addReset)} aria-expanded={formOpen} aria-controls="shoot-new" onClick={() => setFormOpen((o) => !o)}>
          + Shoot without a booking
        </button>
      </div>
      <ShootsTabs current="days" />
      <NewShootForm open={formOpen} onClose={() => setFormOpen(false)} />

      {error?.notReady ? (
        <NotReady />
      ) : error ? (
        <p className={cn(styles.error, "chalk-soft")} role="alert">{error.message}</p>
      ) : !days ? (
        <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Loading the shoots…</p>
      ) : (
        <>
          <section className={css.block} aria-labelledby="shoots-upcoming">
            <h2 id="shoots-upcoming" className={cn(styles.h2, "chalk")}>Coming up</h2>
            {upcoming.length ? <DayGrid days={upcoming} /> : <p className={cn(styles.muted, "chalk-soft")}>No shoots coming up.</p>}
          </section>
          {done.length > 0 && (
            <section className={css.block} aria-labelledby="shoots-done">
              <h2 id="shoots-done" className={cn(styles.h2, "chalk")}>Done</h2>
              <DayGrid days={done} done />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DayGrid({ days, done = false }: { days: ShootDay[]; done?: boolean }) {
  return (
    <ul className={cn(css.dayGrid, done && css.doneGrid)}>
      {days.map((d) => (done ? <DoneDayCard key={d.date} day={d} /> : <DayCard key={d.date} day={d} />))}
    </ul>
  );
}

function DayCard({ day }: { day: ShootDay }) {
  const p = dayParts(day.date);
  const href = `/admin/shoots/${day.date}`;
  return (
    <li className={cn(css.card, css.dayCard)}>
      <h3 className={css.dayHead}>
        <Link href={href}>
          {p.weekday}, <span className={css.dayDate}>{p.month} {p.day}</span>
        </Link>
      </h3>
      <DayDetails day={day} />
      <p className={css.cardCta}>
        <Link href={href} className={styles.smallButton}>
          Open day sheet →
        </Link>
      </p>
    </li>
  );
}

/**
 * A day that's over, folded to one slim row (owner, Nov 11: done days "covering a lot of space"): the day, each shoot's
 * time and family, and "Open day sheet"; tapping the row shows the rest (ticks, folders, inspo counts).
 */
function DoneDayCard({ day }: { day: ShootDay }) {
  const p = dayParts(day.date);
  return (
    <li className={cn(css.card, css.doneCard)}>
      <details className={css.doneFold}>
        <summary className={css.doneHead}>
          <h3 className={css.doneDay}>
            {p.weekday}, <span className={css.dayDate}>{p.month} {p.day}</span>
          </h3>
          <span className={css.doneShoots}>
            {day.shoots.map((s) => (
              <span key={s.key}>
                <span className={css.time}>{clock(s.start)}</span> {s.title}
              </span>
            ))}
          </span>
        </summary>
        <DayDetails day={day} />
      </details>
      <Link href={`/admin/shoots/${day.date}`} className={cn(styles.smallButton, css.doneCta)}>
        Open day sheet →
      </Link>
    </li>
  );
}

/** A day's count, sunset, ticks and its shoots (links to their folders). */
function DayDetails({ day }: { day: ShootDay }) {
  const pct = day.total ? Math.round((day.ticked / day.total) * 100) : 0;
  return (
    <>
      <p className={cn(css.meta, "chalk-soft")}>
        {plural(day.shoots.length, "shoot", "shoots")}
        {day.sunset ? ` · sunset ${clock(day.sunset)}` : ""}
      </p>
      <div className={css.bar} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className={cn(css.ticked, "chalk-soft")}>
        {day.ticked} of {day.total} ticked
      </p>
      <ul className={css.shootList}>
        {day.shoots.map((s) => {
          const counts = inspoCounts(s.inspoCount, s.btsCount);
          return (
            <li key={s.key}>
              <Link href={`/admin/shoots/folder/${s.key}`} className={css.shootLink}>
                <span className={css.time}>{clock(s.start)}</span>
                <span className={css.family}>
                  {s.title}
                  <small>{s.kind === "styled" ? "No booking" : s.bundleName}</small>
                </span>
                <span className={cn(css.counts, counts.inspo ? "" : css.warn)}>
                  <span>{counts.inspo ?? "No inspo yet"}</span>
                  {counts.bts && <span>{counts.bts}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** "+ Shoot without a booking": title, day, start, place → the new shoot's folder. */
function NewShootForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const shoot = await shootsApi.createStyled({
        title: String(f.get("title") ?? ""),
        date: String(f.get("date") ?? ""),
        startTime: String(f.get("start") ?? "") || null,
        place: String(f.get("place") ?? "") || null,
      });
      router.push(`/admin/shoots/folder/${shoot.key}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form id="shoot-new" className={cn(css.card, css.newForm)} hidden={!open} onSubmit={submit} aria-labelledby="shoot-new-title">
      <h2 id="shoot-new-title">New shoot without a booking</h2>
      <p className={cn(styles.hintSmall, "chalk-soft")}>For styled shoots, set tests and Instagram content days.</p>
      <div className={css.fields}>
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="nf-title">What is it?</label>
          <input ref={titleRef} className={styles.input} id="nf-title" name="title" required maxLength={120} placeholder="e.g. Valentine's set test" />
        </div>
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="nf-date">Day</label>
          <input className={styles.input} id="nf-date" name="date" type="date" required defaultValue={tomorrowMiami()} />
        </div>
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="nf-start">Starts</label>
          <input className={styles.input} id="nf-start" name="start" type="time" required defaultValue="15:00" />
        </div>
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor="nf-place">Where</label>
          <input className={styles.input} id="nf-place" name="place" maxLength={200} placeholder="e.g. Our place, Miami Beach" />
        </div>
      </div>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
      <div className={css.actions}>
        <button className={styles.smallButton} type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create the folder"}
        </button>
        <button className={cn(styles.linkButton, "chalk-soft")} type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
