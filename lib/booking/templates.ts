import { site } from "@/config/site";
import type { Bundle } from "@/config/bundles";
import { formatMoney, type PriceQuote } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "./dates";
import type { BookingConsents, BookingContact, SessionAddress } from "./types";

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
  /** Price actually booked. */
  pricing: PriceQuote;
  /** Optional permissions given at booking. */
  consents?: BookingConsents;
}

/** "Yes" / "No" lines for the permissions (studio's calendar + emails). */
export function consentRows(c: BookingConsents | undefined): [string, string][] {
  return [
    ["OK to text", c?.sms ? "Yes" : "No"],
    ["OK to feature photos", c?.photos ? "Yes (website + social media)" : "No"],
  ];
}

/** Price lines for emails/calendar: regular, offer or code, then the total. */
export function pricingRows(p: PriceQuote): [string, string][] {
  const rows: [string, string][] = [];
  if (p.pricingType === "offer") rows.push(["Regular price", formatMoney(p.regularCents)], [p.offerLabel || "Special offer", formatMoney(p.offerCents ?? p.finalCents)]);
  if (p.pricingType === "discount") rows.push(["Regular price", formatMoney(p.regularCents)], ["Discount code", p.discountCode ?? ""], ["Discount", `-${formatMoney(p.discountCents)}`]);
  rows.push(["Package total", formatMoney(p.finalCents)]);
  return rows;
}

/** What a reschedule email needs. */
export interface RescheduleDetails {
  reference: string;
  parentName: string;
  email: string;
  phone: string;
  bundleName: string;
  /** Final booked price (cents). */
  packageTotalCents: number;
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

/** What a session reminder email needs. */
export interface ReminderDetails {
  reference: string;
  parentName: string;
  bundleName: string;
  /** Session date (studio time zone), start and end ("HH:MM"). */
  date: string;
  start: string;
  end: string;
  location: string;
  /** Gate code, parking, concierge (the family's own notes; shown in the 24-hour reminder). */
  accessNotes?: string | null;
}

/** What the after-session and gallery emails need. */
export interface AfterSessionDetails {
  reference: string;
  parentName: string;
  babyName?: string | null;
  bundleName: string;
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

/** "1204" → "Unit 1204"; "Apt 4B", "#4B" or "PH 2" stay as typed. */
export const unitLine = (unit?: string) => {
  const u = unit?.trim();
  return !u ? "" : /^\d/.test(u) ? `Unit ${u}` : u;
};

export const formatAddress = (a: SessionAddress) => [a.street, unitLine(a.unit), a.city].filter(Boolean).join(", ") + `, FL ${a.zip}`;

/** Studio-facing label for the gate / parking / concierge notes (calendar, studio email, /admin). */
export const ACCESS_LABEL = "Gate / parking / concierge";

/** Calendar event subject: no sensitive details in the title. */
export function eventSubject(d: BookingDetails): string {
  return `Tiny Humans - ${d.bundle.name} - ${d.contact.parentName}`;
}

/** Calendar event body (for the studio's own calendar). */
export function eventBodyHtml(d: BookingDetails): string {
  const rows: [string, string | undefined][] = [
    ["Booking reference", d.reference],
    ["Package", d.bundle.name],
    ...pricingRows(d.pricing),
    ["Due at booking", "$0 (nothing collected)"],
    ["Payment due", "After the photoshoot"],
    ["Parent / guardian", d.contact.parentName],
    ["Email", d.contact.email],
    ["Phone", d.contact.phone],
    ["Baby's name", d.contact.babyName],
    ["Baby's age", d.contact.babyAge],
    ["Address", formatAddress(d.address)],
    [ACCESS_LABEL, d.address.accessNotes],
    ["Inspiration photo", d.inspirationTitle],
    ["Notes", d.contact.notes],
    ...consentRows(d.consents),
  ];
  return `<table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#555"><b>${esc(k)}</b></td><td>${esc(v!).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")}</table>`;
}
