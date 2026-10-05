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
    ["Price", formatPrice(d.bundle.price)],
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
    <p style="margin:0;font-size:16px;line-height:1.5;color:${C.ink}">Thank you for choosing Tiny Humans. We can't wait to meet your little one. We'll bring the whole studio to your home, so all you need to do is stay comfy.</p>
  </td></tr>
  <tr><td style="padding:16px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px dashed ${C.blue};border-bottom:2px dashed ${C.blue}">
      ${line("Reference", d.reference)}
      ${line("Package", d.bundle.name)}
      ${line("Price", formatPrice(d.bundle.price))}
      ${line("Date", formatLongDate(d.date))}
      ${line("Time", `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`)}
      ${line("Location", formatAddress(d.address))}
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
