import { site } from "@/config/site";
import { formatPrice, type Bundle } from "@/config/bundles";
import { formatLongDate, formatTimeLabel } from "./dates";
import type { BookingContact, SessionAddress } from "./types";

/** Data used by the calendar event and the confirmation email. */
export interface BookingDetails {
  reference: string;
  bundle: Bundle;
  date: string;
  start: string;
  end: string;
  contact: BookingContact;
  address: SessionAddress;
  inspirationTitle?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Payment wording: nothing is collected at booking; the bundle is paid after the photoshoot. */
export const PAYMENT_NOTE = {
  page: "Payment is not required today. Your session is reserved, and payment for your selected bundle will be due once your photoshoot is completed.",
  email: "Payment is not required at the time of booking. Payment for your session will be due once your photoshoot is completed.",
};

export const formatAddress = (a: SessionAddress) => `${a.street}, ${a.city}, FL ${a.zip}`;

/** Calendar event subject: no sensitive details in the title. */
export function eventSubject(d: BookingDetails): string {
  return `Tiny Humans - ${d.bundle.name} - ${d.contact.parentName}`;
}

/** Calendar event body (for the studio's own calendar). */
export function eventBodyHtml(d: BookingDetails): string {
  const rows: [string, string | undefined][] = [
    ["Booking reference", d.reference],
    ["Package", d.bundle.name],
    ["Package total", formatPrice(d.bundle.price)],
    ["Due at booking", "$0 (nothing collected)"],
    ["Payment due", "After the photoshoot"],
    ["Parent / guardian", d.contact.parentName],
    ["Email", d.contact.email],
    ["Phone", d.contact.phone],
    ["Baby's name", d.contact.babyName],
    ["Baby's age", d.contact.babyAge],
    ["Address", formatAddress(d.address)],
    ["Inspiration photo", d.inspirationTitle],
    ["Notes", d.contact.notes],
  ];
  return `<table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#555"><b>${esc(k)}</b></td><td>${esc(v!).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")}</table>`;
}

const C = { green: "#183a22", greenDark: "#0f2817", yellow: "#fcd91c", blue: "#6cc6f7", white: "#ffffff", chalk: "#f4f2ea", ink: "#1f2a22", muted: "#5b6b5f" };

/** Confirmation email: inline styles only, table layout (works in Outlook and on phones). */
export function confirmationEmail(d: BookingDetails): { subject: string; html: string } {
  const firstName = d.contact.parentName.split(" ")[0];
  const when = `${formatLongDate(d.date)}, ${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`;
  const line = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:${C.muted};font-size:14px;width:120px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;color:${C.ink};font-size:15px;font-weight:bold">${esc(value)}</td></tr>`;
  const logo = `${site.url.replace(/\/$/, "")}/brand/default/logo-full.jpg`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${C.chalk}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.chalk};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.white};border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center" style="background:${C.green};padding:22px 20px">
    <img src="${logo}" width="120" alt="Tiny Humans" style="display:block;border:0;width:120px;height:auto;border-radius:8px">
  </td></tr>
  <tr><td style="height:6px;background:${C.yellow};line-height:6px;font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:28px 28px 8px">
    <h1 style="margin:0 0 10px;font-size:24px;color:${C.green}">You're booked, ${esc(firstName)}!</h1>
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#2a8fc4">Booking confirmed</p>
    <p style="margin:0;font-size:16px;line-height:1.5;color:${C.ink}">Thank you for choosing Tiny Humans. We can't wait to meet your little one. We'll bring the whole studio to your home, so all you need to do is stay comfy.</p>
  </td></tr>
  <tr><td style="padding:16px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px dashed ${C.blue};border-bottom:2px dashed ${C.blue}">
      ${line("Reference", d.reference)}
      ${line("Package", d.bundle.name)}
      ${line("Date", formatLongDate(d.date))}
      ${line("Time", `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`)}
      ${line("Location", formatAddress(d.address))}
      ${line("Package total", formatPrice(d.bundle.price))}
    </table>
  </td></tr>
  <tr><td style="padding:4px 28px 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8d6;border:2px solid ${C.yellow};border-radius:10px">
      <tr><td style="padding:14px 16px 4px;font-size:16px;font-weight:bold;color:${C.green}">Payment</td></tr>
      <tr><td style="padding:0 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${line("Due today", "$0")}
          ${line("Package total", formatPrice(d.bundle.price))}
          ${line("Payment due", "After the photoshoot")}
        </table>
      </td></tr>
      <tr><td style="padding:6px 16px 14px;font-size:14px;line-height:1.5;color:${C.ink}">${esc(PAYMENT_NOTE.email)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:4px 28px 8px">
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${C.ink}">Our sessions are baby-led. Time is allowed for feeding, changing and comforting your little one whenever needed.</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${C.ink}">If you need to make a change to your session, reply to this email.</p>
  </td></tr>
  <tr><td style="padding:16px 28px 26px;border-top:1px solid #e6e6e6">
    <p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted}">Tiny Humans · Newborn &amp; baby photography in ${esc(site.location)}<br>
    <a href="mailto:${site.contact.email}" style="color:${C.green}">${site.contact.email}</a> · <a href="${site.social.instagram.url}" style="color:${C.green}">${site.social.instagram.handle ?? "Instagram"}</a><br>
    <a href="${site.url}" style="color:${C.green}">${site.url.replace(/^https?:\/\//, "")}</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject: `Your Tiny Humans session is booked (${d.reference}): ${when}`, html };
}

/** Internal "new booking" email for Tiny Humans: plain, scannable, inline styles. */
export function internalNotificationEmail(d: BookingDetails, createdAt: Date): { subject: string; html: string; text: string } {
  const created = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(createdAt);
  const rows: [string, string][] = [
    ["Booking reference", d.reference],
    ["Parent / guardian", d.contact.parentName],
    ["Customer email", d.contact.email],
    ["Customer phone", d.contact.phone],
    ["Baby name", d.contact.babyName || "Not provided"],
    ["Baby age", d.contact.babyAge],
    ["Bundle", d.bundle.name],
    ["Package total", formatPrice(d.bundle.price)],
    ["Due today", "$0"],
    ["Payment due", "After the photoshoot"],
    ["Session date", formatLongDate(d.date)],
    ["Session time", `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`],
    ["Location type", "At the family's home (we bring the studio)"],
    ["Session address", formatAddress(d.address)],
    ["Customer notes", d.contact.notes || "None"],
    ["Inspiration photo", d.inspirationTitle || "None"],
    ["Booked at", `${created} (Eastern)`],
  ];
  const rowHtml = rows
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 ? "#ffffff" : "#f6f8f6"}"><td style="padding:8px 10px;width:150px;font-size:13px;color:${C.muted};vertical-align:top">${esc(k)}</td><td style="padding:8px 10px;font-size:15px;color:${C.ink};font-weight:bold">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 10px;background:#f2f2f2">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="background:${C.green};padding:16px 22px;color:${C.yellow};font-size:20px;font-weight:bold;letter-spacing:1px">NEW BOOKING</td></tr>
  <tr><td style="padding:16px 22px 6px;font-size:16px;color:${C.ink}"><b>${esc(d.contact.parentName)}</b> booked <b>${esc(d.bundle.name)}</b> for <b>${esc(formatLongDate(d.date))}</b> at <b>${esc(formatTimeLabel(d.start))}</b>.</td></tr>
  <tr><td style="padding:6px 22px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rowHtml}</table></td></tr>
  <tr><td style="padding:0 22px 20px;font-size:13px;color:${C.muted}">Reply to this email to answer ${esc(d.contact.parentName.split(" ")[0])} directly. The session is on the Outlook calendar.</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = ["NEW BOOKING", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  return { subject: `New Tiny Humans Booking — ${d.contact.parentName} — ${formatLongDate(d.date)}`, html, text };
}
