import { formatPrice } from "@/config/bundles";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatAddress, type BookingDetails, type CancellationDetails, type RescheduleDetails } from "@/lib/booking/templates";
import { esc } from "../layout";
import type { RenderedEmail } from "../types";

/** Internal emails for Tiny Humans: plain, scannable, light background, no images. */
const C = { green: "#183a22", yellow: "#fcd91c", red: "#b3261e", ink: "#1f2a22", muted: "#5b6b5f" };

const eastern = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(d) + " (Eastern)";

function internalLayout(banner: string, bannerBg: string, bannerFg: string, summary: string, rows: [string, string][], footer: string): string {
  const rowHtml = rows
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 ? "#ffffff" : "#f6f8f6"}"><td style="padding:8px 10px;width:150px;font-size:13px;color:${C.muted};vertical-align:top">${esc(k)}</td><td style="padding:8px 10px;font-size:15px;color:${C.ink};font-weight:bold">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 10px;background:#f2f2f2">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td bgcolor="${bannerBg}" style="background:${bannerBg};padding:16px 22px;color:${bannerFg};font-size:20px;font-weight:bold;letter-spacing:1px">${esc(banner)}</td></tr>
  <tr><td style="padding:16px 22px 6px;font-size:16px;color:${C.ink}">${summary}</td></tr>
  <tr><td style="padding:6px 22px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rowHtml}</table></td></tr>
  <tr><td style="padding:0 22px 20px;font-size:13px;color:${C.muted}">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** New booking / lead notification. */
export function internalNewBookingEmail(d: BookingDetails, createdAt: Date): RenderedEmail {
  const rows: [string, string][] = [
    ["Booking reference", d.reference],
    ["Parent / guardian", d.contact.parentName],
    ["Customer email", d.contact.email],
    ["Customer phone", d.contact.phone],
    ["Baby name", d.contact.babyName || "Not provided"],
    ["Baby age", d.contact.babyAge],
    ["Bundle", d.bundle.name],
    ["Package total", formatPrice(d.bundle.price)],
    ["Payment due", "After the photoshoot"],
    ["Session date", formatLongDate(d.date)],
    ["Session time", `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`],
    ["Location type", "At the family's home (we bring the studio)"],
    ["Session address", formatAddress(d.address)],
    ["Customer notes", d.contact.notes || "None"],
    ["Inspiration photo", d.inspirationTitle || "None"],
    ["Booked at", eastern(createdAt)],
  ];
  const html = internalLayout(
    "NEW BOOKING",
    C.green,
    C.yellow,
    `<b>${esc(d.contact.parentName)}</b> booked <b>${esc(d.bundle.name)}</b> for <b>${esc(formatLongDate(d.date))}</b> at <b>${esc(formatTimeLabel(d.start))}</b>.`,
    rows,
    `Reply to this email to answer ${esc(d.contact.parentName.split(" ")[0])} directly. The session is on the Outlook calendar.`,
  );
  return { subject: `New Tiny Humans Booking — ${d.contact.parentName} — ${formatLongDate(d.date)}`, html, text: ["NEW BOOKING", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n"), attachments: [] };
}

/** Cancelled booking notification. */
export function internalCancellationEmail(c: CancellationDetails): RenderedEmail {
  const rows: [string, string][] = [
    ["Booking reference", c.reference],
    ["Customer name", c.parentName],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Bundle", c.bundleName],
    ["Original date", formatLongDate(c.date)],
    ["Original time", `${formatTimeLabel(c.start)} to ${formatTimeLabel(c.end)}`],
    ["Cancellation reason", c.reason],
    ["Cancelled at", eastern(c.cancelledAt)],
    ["Cancelled by", c.cancelledBy === "admin" ? "Tiny Humans (admin)" : "The customer"],
  ];
  const html = internalLayout(
    "CANCELLED BOOKING",
    C.red,
    "#ffffff",
    `<b>${esc(c.parentName)}</b>'s <b>${esc(c.bundleName)}</b> session on <b>${esc(formatLongDate(c.date))}</b> at <b>${esc(formatTimeLabel(c.start))}</b> was cancelled. The time is free again and the Outlook event has been removed.`,
    rows,
    `Reply to this email to contact ${esc(c.parentName.split(" ")[0])} directly.`,
  );
  return { subject: `Cancelled: Tiny Humans Booking — ${c.parentName} — ${formatLongDate(c.date)} (${c.reference})`, html, text: ["CANCELLED BOOKING", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n"), attachments: [] };
}

/** Lead updated: rescheduled. */
export function internalRescheduleEmail(r: RescheduleDetails): RenderedEmail {
  const rows: [string, string][] = [
    ["Booking reference", r.reference],
    ["Customer name", r.parentName],
    ["Customer email", r.email],
    ["Customer phone", r.phone],
    ["Bundle", r.bundleName],
    ["Previous date/time", `${formatLongDate(r.oldDate)}, ${formatTimeLabel(r.oldStart)} to ${formatTimeLabel(r.oldEnd)}`],
    ["New date/time", `${formatLongDate(r.newDate)}, ${formatTimeLabel(r.newStart)} to ${formatTimeLabel(r.newEnd)}`],
    ["Location", r.location],
    ["Rescheduled by", r.rescheduledBy === "admin" ? "Admin" : "Customer"],
    ["Rescheduled at", eastern(r.rescheduledAt)],
    ["Current status", r.status],
  ];
  const html = internalLayout(
    "LEAD UPDATED · RESCHEDULED",
    "#2a6f9b",
    "#ffffff",
    `<b>${esc(r.parentName)}</b>'s session moved from <b>${esc(formatLongDate(r.oldDate))} ${esc(formatTimeLabel(r.oldStart))}</b> to <b>${esc(formatLongDate(r.newDate))} ${esc(formatTimeLabel(r.newStart))}</b>. The Outlook event has been updated.`,
    rows,
    `Reply to this email to contact ${esc(r.parentName.split(" ")[0])} directly.`,
  );
  return { subject: `Tiny Humans Lead Updated — Rescheduled — ${r.parentName}`, html, text: ["LEAD UPDATED", "RESCHEDULED", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n"), attachments: [] };
}
