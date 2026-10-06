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

/** What a reschedule email needs. */
export interface RescheduleDetails {
  reference: string;
  parentName: string;
  email: string;
  phone: string;
  bundleName: string;
  packagePrice: number;
  location: string;
  oldDate: string;
  oldStart: string;
  oldEnd: string;
  newDate: string;
  newStart: string;
  newEnd: string;
  rescheduledBy: "customer" | "admin";
  rescheduledAt: Date;
  status: string;
}

/** What a cancellation email needs. */
export interface CancellationDetails {
  reference: string;
  parentName: string;
  email: string;
  phone: string;
  bundleName: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  cancelledAt: Date;
  cancelledBy: "customer" | "admin";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Payment wording: nothing is collected at booking; the bundle is paid after the photoshoot. */
export const PAYMENT_NOTE = {
  page: "Payment is not required at the time of booking. Payment for your session will be due once your photoshoot is completed.",
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
