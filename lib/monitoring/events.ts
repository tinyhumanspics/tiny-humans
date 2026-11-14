import { bookingRules } from "@/config/booking";

/**
 * Failure log (brief 01): what can fail silently, how the owner hears about it, and the daily health report.
 * Pure (no database, no email): unit tested. lib/monitoring/server.ts saves rows and sends the emails.
 */
export const AREAS = ["stripe_webhook", "booking", "graph", "email", "meta_capi", "api", "cron"] as const;
export type Area = (typeof AREAS)[number];
/** critical = emails the owner right away (at most once per area per hour); error/warning wait for the daily report. */
export type Severity = "critical" | "error" | "warning";

export const AREA_LABEL: Record<Area, string> = {
  stripe_webhook: "Stripe payments (webhook)",
  booking: "Booking or request creation",
  graph: "Outlook calendar (Microsoft)",
  email: "Emails (Resend)",
  meta_capi: "Meta Conversions API",
  api: "Website server error",
  cron: "Daily jobs",
};

/** What the owner can check when an alert arrives. */
export const AREA_ACTION: Record<Area, string> = {
  stripe_webhook: "Payments may not show as paid in /admin. Check Stripe → Developers → Webhooks → Event deliveries.",
  booking: "A family may not have been able to book. Check /admin → Leads and your Outlook calendar.",
  graph: "Check that new sessions still appear in Outlook. If Microsoft sign-in fails, the Entra client secret may have expired.",
  email: "Some emails may not have reached families. Check resend.com → Emails.",
  meta_capi: "Meta may be missing booking events. Check Events Manager.",
  api: "Part of the website answered with an error.",
  cron: "Reminders or deposit checks may not have run today.",
};

export const ALERT_WINDOW_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** The daily check deletes older rows. */
export const KEEP_DAYS = 90;

/** Our own wording + codes only. One line, cut, and anything that looks like an email or phone number masked. */
export function cleanMessage(text: string, max = 300): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")
    .replace(/\+?\(?\d[\d ().-]{6,}\d/g, "[number]")
    .trim()
    .slice(0, max);
}

/** A booking reference, event id or path: short and plain. */
export function cleanRef(ref?: string | null): string | null {
  const r = ref?.replace(/[^\w.:/# -]/g, "").trim().slice(0, 120);
  return r || null;
}

export interface LoggedEvent {
  at: Date;
  area: string;
  severity: string;
  message: string;
  ref: string | null;
}

export interface HealthReport {
  /** problems = failures or warnings; all_good = the Monday line; quiet = nothing to send. */
  kind: "problems" | "all_good" | "quiet";
  failures: number;
  critical: number;
  /** `latest`: up to 3 different messages, newest first, with how many times each happened. */
  areas: { area: string; label: string; count: number; critical: number; latest: (LoggedEvent & { times: number })[] }[];
  warnings: string[];
  send: boolean;
}

export function isMondayInMiami(now: Date): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: bookingRules.timeZone, weekday: "short" }).format(now) === "Mon";
}

/** GRAPH_SECRET_EXPIRES (YYYY-MM-DD): a warning from 30 days before the Microsoft client secret expires. */
export function graphSecretWarning(expires: string | undefined, now: Date): string | null {
  const value = expires?.trim();
  if (!value) return "GRAPH_SECRET_EXPIRES isn't set in Vercel, so the Microsoft (Outlook) secret's expiry can't be checked.";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return `GRAPH_SECRET_EXPIRES (${value.slice(0, 20)}) isn't a date like 2028-10-04.`;
  const days = Math.ceil((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - now.getTime()) / DAY_MS);
  if (days > 30) return null;
  const how = "Create a new client secret in Entra → App registrations → Certificates & secrets, put it in Vercel as MICROSOFT_CLIENT_SECRET, change GRAPH_SECRET_EXPIRES to its new date, then redeploy.";
  if (days < 0) return `The Microsoft (Outlook) client secret expired ${-days} day${days === -1 ? "" : "s"} ago (${value}): new sessions can't reach Outlook. ${how}`;
  return `The Microsoft (Outlook) client secret expires in ${days} day${days === 1 ? "" : "s"} (${value}). ${how}`;
}

/** Same message + ref counted once (newest time kept), newest first. */
function newestDistinct(list: LoggedEvent[]): (LoggedEvent & { times: number })[] {
  const seen = new Map<string, LoggedEvent & { times: number }>();
  for (const e of [...list].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const key = `${e.message}\u0000${e.ref ?? ""}`;
    const first = seen.get(key);
    if (first) first.times += 1;
    else seen.set(key, { ...e, times: 1 });
  }
  return [...seen.values()];
}

/** The daily report from the last 24 hours of rows. Sends when something failed or needs doing, and every Monday. */
export function buildHealthReport({ events, now, graphSecretExpires, extraWarnings = [] }: { events: LoggedEvent[]; now: Date; graphSecretExpires?: string; extraWarnings?: string[] }): HealthReport {
  const byArea = new Map<string, LoggedEvent[]>();
  for (const e of events) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const areas = [...byArea]
    .map(([area, list]) => ({
      area,
      label: AREA_LABEL[area as Area] ?? area,
      count: list.length,
      critical: list.filter((e) => e.severity === "critical").length,
      latest: newestDistinct(list).slice(0, 3),
    }))
    .sort((a, b) => b.critical - a.critical || b.count - a.count);
  const warnings = [...extraWarnings, graphSecretWarning(graphSecretExpires, now)].filter((w): w is string => Boolean(w));
  const failures = events.length;
  const kind = failures || warnings.length ? "problems" : isMondayInMiami(now) ? "all_good" : "quiet";
  return { kind, failures, critical: areas.reduce((n, a) => n + a.critical, 0), areas, warnings, send: kind !== "quiet" };
}
