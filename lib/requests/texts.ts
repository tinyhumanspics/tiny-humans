import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { fill } from "@/lib/email/messages";
import { formatMoney } from "@/lib/pricing/engine";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The owner's texts to a family (/admin → Requests, brief 02), in the request's language. Pure: the API sends them as
 * the `sms:` link's body.
 */
type Locale = "en" | "es";
const t = (locale: Locale) => (locale === "es" ? es : en).bookingRequest.texts;

/** "Thursday, December 10, 2026, 10:00 AM" */
export const slotWhen = (date: string, start: string, locale: Locale) => `${formatLongDate(date, locale)}, ${formatTimeLabel(start, locale)}`;

/** "your due date (…)" or the day and time, as the "Request received" email says it. */
export function requestWhenText(r: { type: string; slotDate: string | null; slotStart: string | null; dueDate: string | null }, locale: Locale): string {
  if (r.type === "due_date" && r.dueDate) return fill((locale === "es" ? es : en).emails.requestReceived.whenDue, { date: formatLongDate(r.dueDate, locale) });
  return slotWhen(r.slotDate ?? "", r.slotStart ?? "", locale);
}

/** /admin → "Send a booking link" (owner, Nov 19): their link with the day (and time), in their language. */
export const linkText = (c: { locale: Locale; date: string; start: string | null; link: string }) =>
  fill(t(c.locale).link, { when: c.start ? slotWhen(c.date, c.start, c.locale) : formatLongDate(c.date, c.locale), link: c.link });

/** "Text": a short hello about their request. */
export const helloText = (name: string, when: string, locale: Locale) => fill(t(locale).hello, { name, when });

/**
 * After "Confirm": the pay link with its deposit, or (nothing to pay: deposits off) that it's booked and the details are
 * in their email. `due` = a due-date reservation (`date` is their due date).
 */
export function confirmText(c: { name: string; locale: Locale; due?: { date: string }; slot?: { date: string; start: string }; depositCents: number; link: string | null }): string {
  const x = t(c.locale);
  const date = c.due ? formatLongDate(c.due.date, c.locale) : "";
  const when = c.slot ? slotWhen(c.slot.date, c.slot.start, c.locale) : "";
  if (c.depositCents > 0 && c.link) return fill(c.due ? x.confirmedDue : x.confirmed, { name: c.name, when, date, deposit: formatMoney(c.depositCents), link: c.link });
  return fill(c.due ? x.reservedDue : x.booked, { name: c.name, when, date });
}
