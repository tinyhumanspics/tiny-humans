import { addDaysKey } from "@/lib/booking/timezone";

/**
 * The dashboard's dates (owner, Nov 25): this month when /admin opens, the month before or after with the arrows, or
 * any from–to range. Studio dates (YYYY-MM-DD, Miami), both days included. Shared by the server and the page.
 */
export interface DashboardPeriod {
  from: string;
  to: string;
}

/** What one bar of the chart covers: days up to a month, weeks up to half a year, months after that. */
export type BucketUnit = "day" | "week" | "month";

/** The longest range the dashboard adds up at once (keeps the queries small). */
export const MAX_PERIOD_DAYS = 731;

export const isDateKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Days from `from` to `to` (0 when the same day). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The calendar month that contains a studio date. */
export function monthOf(dateKey: string): DashboardPeriod {
  const [y, m] = dateKey.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** The month `n` months after (before, when negative) the one that contains `dateKey`. */
export function shiftMonth(dateKey: string, n: number): DashboardPeriod {
  const [y, m] = dateKey.split("-").map(Number);
  return monthOf(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10));
}

export const isWholeMonth = (p: DashboardPeriod) => {
  const m = monthOf(p.from);
  return m.from === p.from && m.to === p.to;
};

/** `?from=&to=` of the dashboard API: none → this month; a bad pair → a sentence for the owner. */
export function parsePeriod(from: string | null, to: string | null, today: string): { period: DashboardPeriod } | { error: string } {
  if (from === null && to === null) return { period: monthOf(today) };
  if (!isDateKey(from) || !isDateKey(to)) return { error: "Pick a start and an end date." };
  if (to < from) return { error: "The end date is before the start date." };
  if (daysBetween(from, to) + 1 > MAX_PERIOD_DAYS) return { error: "Pick up to 2 years at a time." };
  return { period: { from, to } };
}

export function unitFor(p: DashboardPeriod): BucketUnit {
  const days = daysBetween(p.from, p.to) + 1;
  return days <= 31 ? "day" : days <= 26 * 7 ? "week" : "month";
}

/** Monday of the week that contains a studio date. */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysKey(dateKey, -((weekday + 6) % 7));
}

/** The first day of the bar a studio date falls in. */
export function bucketKey(dateKey: string, unit: BucketUnit): string {
  return unit === "day" ? dateKey : unit === "week" ? weekStartKey(dateKey) : `${dateKey.slice(0, 7)}-01`;
}

/** Every bar of the period, oldest first (the first and last weeks or months may be partly outside it). */
export function bucketStarts(p: DashboardPeriod, unit: BucketUnit): string[] {
  const out: string[] = [];
  for (let key = bucketKey(p.from, unit); key <= p.to; key = unit === "day" ? addDaysKey(key, 1) : unit === "week" ? addDaysKey(key, 7) : shiftMonth(key, 1).from) out.push(key);
  return out;
}

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));

/** "November 2026"; "Nov 3 – 20, 2026"; "Dec 15, 2026 – Jan 10, 2027". */
export function periodLabel(p: DashboardPeriod): string {
  if (isWholeMonth(p)) return fmt(p.from, { month: "long", year: "numeric" });
  if (p.from === p.to) return fmt(p.from, { month: "short", day: "numeric", year: "numeric" });
  if (p.from.slice(0, 4) !== p.to.slice(0, 4)) return `${fmt(p.from, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(p.to, { month: "short", day: "numeric", year: "numeric" })}`;
  const end = p.from.slice(0, 7) === p.to.slice(0, 7) ? fmt(p.to, { day: "numeric" }) : fmt(p.to, { month: "short", day: "numeric" });
  return `${fmt(p.from, { month: "short", day: "numeric" })} – ${end}, ${p.to.slice(0, 4)}`;
}

/** A bar's label under the chart: "11/14" (days, weeks), "Nov" or "Jan '27" (months; the year on January and the first bar). */
export function bucketLabel(key: string, unit: BucketUnit, first = false): string {
  const [y, m, d] = key.split("-").map(Number);
  if (unit !== "month") return `${m}/${d}`;
  const name = fmt(key, { month: "short" });
  return first || m === 1 ? `${name} '${String(y).slice(2)}` : name;
}
