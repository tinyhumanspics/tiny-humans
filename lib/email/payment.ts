import { PAYMENT_NOTE } from "@/lib/booking/templates";
import type { BookingDepositInfo } from "@/lib/deposit/types";
import { formatMoney } from "@/lib/pricing/engine";
import { emailMessages, fill, type EmailLocale } from "./messages";

/**
 * The payment box's "due" rows + its note: pay after the session (booked without a deposit), or the deposit (paid, or
 * still to pay when Stripe was down) and the rest. `totalCents`: bundle + add-ons + travel fee.
 */
export function paymentDue(locale: EmailLocale, totalCents: number, deposit?: BookingDepositInfo | null): { rows: [string, string][]; note: string } {
  const m = emailMessages(locale);
  if (!deposit) return { rows: [[m.common.paymentDue, m.common.paymentDueValue]], note: PAYMENT_NOTE.email };
  const x = m.deposit;
  const amount = formatMoney(deposit.amountCents);
  const rest: [string, string] = [x.rest, formatMoney(Math.max(0, totalCents - deposit.amountCents))];
  return deposit.status === "paid"
    ? { rows: [[x.paid, amount], rest], note: fill(x.notePaid, { deposit: amount }) }
    : { rows: [[x.unpaid, fill(x.unpaidValue, { deposit: amount })], rest], note: fill(x.noteUnpaid, { deposit: amount }) };
}

/** The Home Session Prep Guide. Its last line is about paying: with a paid deposit it says so. */
export function prepGuideItems(locale: EmailLocale, depositPaid: boolean): readonly string[] {
  const m = emailMessages(locale);
  return depositPaid ? [...m.prepGuide.items.slice(0, -1), m.deposit.prepGuideLast] : m.prepGuide.items;
}

/** One line about paying for the 24-hour reminder. */
export const payAfterLine = (locale: EmailLocale, depositPaid: boolean) => (depositPaid ? emailMessages(locale).deposit.payAfter : emailMessages(locale).common.payAfter);
