import "server-only";
import { healthReportEmail, systemAlertEmail } from "@/emails/Internal";
import { isDatabaseConfigured } from "@/lib/db/client";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { log } from "@/lib/log";
import { ALERT_WINDOW_MS, AREA_ACTION, AREA_LABEL, DAY_MS, KEEP_DAYS, buildHealthReport, cleanMessage, cleanRef, type Area, type LoggedEvent, type Severity } from "./events";
import * as store from "./store";

/** Where alerts and the daily report go: ALERT_EMAIL (owner, Nov 14: support@…), else the studio inbox. */
export function alertAddress(): string {
  return process.env.ALERT_EMAIL?.trim() || emailConfig().notify;
}

/** When the database itself is down: one alert per area per hour per server instance. */
const lastAlertWithoutDb = new Map<string, number>();

/**
 * Writes a failure-log row and, for critical ones, emails the owner (at most once per area per hour). Never throws and
 * never needs the caller to wait for long: a failure report must not break what already failed. `message` is our own
 * wording + error codes (never customer data); `ref` a booking reference or event id.
 */
export async function recordFailure(area: Area, message: string, opts: { severity?: Severity; ref?: string | null } = {}): Promise<void> {
  const severity = opts.severity ?? "error";
  const text = cleanMessage(message);
  const ref = cleanRef(opts.ref);
  // without a database (local mock mode, CI) there's nothing to save or throttle with
  if (!isDatabaseConfigured()) return;
  try {
    let id: string | null = null;
    try {
      id = await store.insertEvent({ area, severity, message: text, ref });
    } catch (err) {
      log.error("monitor", "Failure log row not saved", { error: err as Error, area });
    }
    if (severity !== "critical") return;
    const now = Date.now();
    let send: boolean;
    if (id) send = await store.claimAlert(id, area, new Date(now - ALERT_WINDOW_MS));
    else {
      send = now - (lastAlertWithoutDb.get(area) ?? 0) >= ALERT_WINDOW_MS;
      if (send) lastAlertWithoutDb.set(area, now);
    }
    if (send) await sendAlert(area, text, ref, new Date(now));
  } catch (err) {
    log.error("monitor", "Failure alert not sent", { error: err as Error, area });
  }
}

async function sendAlert(area: Area, message: string, ref: string | null, at: Date) {
  const email = await systemAlertEmail({ label: AREA_LABEL[area], message, ref, at, action: AREA_ACTION[area] });
  await sendEmail({ scope: "monitoring.alert", from: emailConfig().internalFrom, to: alertAddress(), subject: email.subject, html: email.html, text: email.text });
}

/** The daily health check (cron): emails a report when something failed or needs doing, and every Monday. */
export async function runHealthCheck(now = new Date()) {
  const extraWarnings: string[] = [];
  let events: LoggedEvent[] = [];
  try {
    events = await store.eventsSince(new Date(now.getTime() - DAY_MS));
  } catch (err) {
    log.error("monitor", "Failure log not readable", { error: err as Error });
    extraWarnings.push("The failure log couldn't be read (database problem), so failures from the last 24 hours aren't listed.");
  }
  const report = buildHealthReport({ events, now, graphSecretExpires: process.env.GRAPH_SECRET_EXPIRES, extraWarnings });
  let sent = false;
  if (report.send) {
    const email = await healthReportEmail(report, now);
    await sendEmail({ scope: "monitoring.health", from: emailConfig().internalFrom, to: alertAddress(), subject: email.subject, html: email.html, text: email.text });
    sent = true;
  }
  await store.purgeBefore(new Date(now.getTime() - KEEP_DAYS * DAY_MS)).catch((err) => log.error("monitor", "Old failure rows not deleted", { error: err as Error }));
  return { kind: report.kind, failures: report.failures, critical: report.critical, warnings: report.warnings.length, sent };
}
