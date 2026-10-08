import { site } from "@/config/site";
import type { Bundle } from "@/config/bundles";
import { formatMoney, type PriceQuote } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "./dates";
import type { BookingConsents, BookingContact, SessionAddress } from "./types";
import type { BookingTravel } from "@/lib/travel/types";
import type { BookingDepositInfo } from "@/lib/deposit/types";
import type { DepositOutcome } from "@/lib/deposit/refund";
import { backdropNames } from "./backdrop-names";

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
  /** Travel fee on top of the bundle. */
  travel?: BookingTravel;
  /** Backdrop picks (ids), if they chose already. */
  backdrops?: string[];
  /** The saved address line, when the details are rebuilt from a booking row (instead of `address`). */
  location?: string;
  /** The deposit paid while booking (none = booked without a deposit). */
  deposit?: BookingDepositInfo;
}

/** Studio-facing travel line (calendar, studio email, /admin). */
export function travelOwnerLine(t: BookingTravel | undefined): string {
  if (!t || t.feeCents === null) return "Not calculated (travel fees off)";
  if (t.miles === null) return "Distance unknown (ZIP not in the Census list): confirm a travel fee with the family";
  return t.feeCents > 0 ? `${formatMoney(t.feeCents)} (about ${t.miles} miles)` : `No fee (about ${t.miles} miles)`;
}

/** Studio-facing payment lines (calendar, studio email): what was paid while booking and what's due after. */
export function depositOwnerRows(d: Pick<BookingDetails, "deposit" | "pricing" | "travel">): [string, string][] {
  const dep = d.deposit;
  if (!dep) return [["Due at booking", "$0 (nothing collected)"], ["Payment due", "After the photoshoot"]];
  const rest = formatMoney(Math.max(0, totalDueCents(d.pricing, d.travel) - dep.amountCents));
  return dep.status === "paid"
    ? [["Deposit", `${formatMoney(dep.amountCents)} paid on Stripe`], ["Payment due", `${rest} after the photoshoot`]]
    : [["Deposit", `${formatMoney(dep.amountCents)} NOT PAID (Stripe was down): send them the payment link`], ["Payment due", `${rest} after the photoshoot (+ the deposit)`]];
}

/** Bundle price + travel fee. */
export const totalDueCents = (p: PriceQuote, t?: BookingTravel) => p.finalCents + (t?.feeCents ?? 0);

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
  /** Bundle + travel fee (cents), and the deposit paid while booking (none = booked without one). */
  totalCents?: number;
  deposit?: BookingDepositInfo;
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
  /** Backdrop picks (ids), if they chose already (72-hour reminder). */
  backdrops?: string[];
  /** A deposit was paid while booking (the payment lines say so). */
  depositPaid?: boolean;
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
  /** The paid deposit: refunded, kept, or a refund that failed (none = no paid deposit). */
  deposit?: DepositOutcome | null;
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
    ["Travel", travelOwnerLine(d.travel)],
    ...(d.travel?.feeCents ? [["Total due", formatMoney(totalDueCents(d.pricing, d.travel))] as [string, string]] : []),
    ...depositOwnerRows(d),
    ["Parent / guardian", d.contact.parentName],
    ["Email", d.contact.email],
    ["Phone", d.contact.phone],
    ["Baby's name", d.contact.babyName],
    ["Baby's age", d.contact.babyAge],
    ["Address", d.location ?? formatAddress(d.address)],
    [ACCESS_LABEL, d.address.accessNotes],
    ["Backdrop", d.backdrops?.length ? backdropNames(d.backdrops) : "Not chosen yet"],
    ["Inspiration photo", d.inspirationTitle],
    ["Notes", d.contact.notes],
    ...consentRows(d.consents),
  ];
  return `<table cellpadding="4" style="font-family:Arial,sans-serif;font-size:14px">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#555"><b>${esc(k)}</b></td><td>${esc(v!).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")}</table>`;
}
