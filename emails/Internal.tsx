import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatAddress, pricingRows, type BookingDetails, type CancellationDetails, type RescheduleDetails } from "@/lib/booking/templates";
import { renderHtml } from "@/lib/email/render";
import type { RenderedEmail } from "@/lib/email/types";
import { InternalLayout, INTERNAL_COLORS as C } from "./components/InternalLayout";

/* Emails to the studio (English only: they go to the owner, not to families). */

const eastern = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(d) + " (Eastern)";
const firstName = (name: string) => name.split(" ")[0];
const text = (heading: string[], rows: [string, string][]) => [...heading, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");

/** New booking / lead notification. */
export async function internalNewBookingEmail(d: BookingDetails, createdAt: Date): Promise<RenderedEmail> {
  const rows: [string, string][] = [
    ["Booking reference", d.reference],
    ["Parent / guardian", d.contact.parentName],
    ["Customer email", d.contact.email],
    ["Customer phone", d.contact.phone],
    ["Baby name", d.contact.babyName || "Not provided"],
    ["Baby age", d.contact.babyAge],
    ["Bundle", d.bundle.name],
    ["Pricing", d.pricing.pricingType === "offer" ? `Special offer (${d.pricing.offerLabel})` : d.pricing.pricingType === "discount" ? `Discount code ${d.pricing.discountCode}` : "Regular price"],
    ...(d.pricing.pricingType === "regular" ? [["Regular price", formatMoney(d.pricing.regularCents)] as [string, string]] : []),
    ...pricingRows(d.pricing).map(([k, v]) => [k === "Package total" ? "Final package total" : k, v] as [string, string]),
    ["Payment due", "After the photoshoot"],
    ["Session date", formatLongDate(d.date)],
    ["Session time", `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`],
    ["Location type", "At the family's home (we bring the studio)"],
    ["Session address", formatAddress(d.address)],
    ["Customer notes", d.contact.notes || "None"],
    ["Inspiration photo", d.inspirationTitle || "None"],
    ["Booked at", eastern(createdAt)],
  ];
  const html = await renderHtml(
    <InternalLayout
      banner="NEW BOOKING"
      bannerBg={C.green}
      bannerFg={C.yellow}
      summary={
        <>
          <b>{d.contact.parentName}</b> booked <b>{d.bundle.name}</b> for <b>{formatLongDate(d.date)}</b> at <b>{formatTimeLabel(d.start)}</b>.
        </>
      }
      rows={rows}
      footer={`Reply to this email to answer ${firstName(d.contact.parentName)} directly. The session is on the Outlook calendar.`}
    />,
  );
  return { subject: `New Tiny Humans Booking — ${d.contact.parentName} — ${formatLongDate(d.date)}`, html, text: text(["NEW BOOKING"], rows), attachments: [] };
}

/** Cancelled booking notification. */
export async function internalCancellationEmail(c: CancellationDetails): Promise<RenderedEmail> {
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
  const html = await renderHtml(
    <InternalLayout
      banner="CANCELLED BOOKING"
      bannerBg={C.red}
      bannerFg="#ffffff"
      summary={
        <>
          <b>{c.parentName}</b>&apos;s <b>{c.bundleName}</b> session on <b>{formatLongDate(c.date)}</b> at <b>{formatTimeLabel(c.start)}</b> was cancelled. The time is free again and the Outlook event has been
          removed.
        </>
      }
      rows={rows}
      footer={`Reply to this email to contact ${firstName(c.parentName)} directly.`}
    />,
  );
  return { subject: `Cancelled: Tiny Humans Booking — ${c.parentName} — ${formatLongDate(c.date)} (${c.reference})`, html, text: text(["CANCELLED BOOKING"], rows), attachments: [] };
}

/** Lead updated: rescheduled. */
export async function internalRescheduleEmail(r: RescheduleDetails): Promise<RenderedEmail> {
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
  const html = await renderHtml(
    <InternalLayout
      banner="LEAD UPDATED · RESCHEDULED"
      bannerBg={C.blue}
      bannerFg="#ffffff"
      summary={
        <>
          {/* One text node per run: React would add <!-- --> markers between adjacent text pieces. */}
          <b>{r.parentName}</b>&apos;s session moved from <b>{`${formatLongDate(r.oldDate)} ${formatTimeLabel(r.oldStart)}`}</b> to <b>{`${formatLongDate(r.newDate)} ${formatTimeLabel(r.newStart)}`}</b>. The
          Outlook event has been updated.
        </>
      }
      rows={rows}
      footer={`Reply to this email to contact ${firstName(r.parentName)} directly.`}
    />,
  );
  return { subject: `Tiny Humans Lead Updated — Rescheduled — ${r.parentName}`, html, text: text(["LEAD UPDATED", "RESCHEDULED"], rows), attachments: [] };
}
