import { site } from "@/config/site";
import { formatPrice } from "@/config/bundles";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatAddress, PAYMENT_NOTE, type BookingDetails } from "@/lib/booking/templates";
import { rescheduleNoticeText } from "@/lib/booking/reschedule-policy";
import { button, chalkBox, details, esc, heading, paragraph, renderLayout, textLines } from "../layout";
import { emailTheme } from "../theme";
import type { ImageMode, RenderedEmail } from "../types";

/** Customer booking confirmation (follows the active website theme). */
export function bookingConfirmationEmail(
  d: BookingDetails,
  opts: { themeId: string; cancelUrl?: string; rescheduleUrl?: string; rescheduleNoticeHours?: number; images?: ImageMode },
): RenderedEmail {
  const t = emailTheme(opts.themeId);
  const first = d.contact.parentName.split(" ")[0];
  const time = `${formatTimeLabel(d.start)} to ${formatTimeLabel(d.end)}`;
  const body = [
    heading(t, "Booking confirmed", `You're booked, ${first}!`),
    paragraph(t, `Thank you for choosing Tiny Humans. We can't wait to meet ${esc(d.contact.babyName || "your little one")}. We'll bring the whole studio to your home, so all you need to do is stay comfy.`, { align: "center" }),
    details(t, [
      ["Reference", d.reference],
      ["Bundle", d.bundle.name],
      ["Date", formatLongDate(d.date)],
      ["Time", time],
      ["Location", formatAddress(d.address)],
      ["Package total", formatPrice(d.bundle.price)],
    ]),
    chalkBox(t, "Payment", [["Package total", formatPrice(d.bundle.price)], ["Payment due", "After the photoshoot"]], PAYMENT_NOTE.email),
    paragraph(t, "Our sessions are baby-led. Time is allowed for feeding, changing and comforting your little one whenever needed."),
    paragraph(t, "If you need to make a change to your session, reply to this email."),
    opts.rescheduleUrl && opts.rescheduleNoticeHours !== undefined ? paragraph(t, esc(rescheduleNoticeText(opts.rescheduleNoticeHours)), { align: "center" }) : "",
    opts.rescheduleUrl ? button(t, "Reschedule Booking", opts.rescheduleUrl, "outline") : "",
    opts.cancelUrl ? button(t, "Cancel Booking", opts.cancelUrl, "outline", "You'll be asked to confirm on the next page.") : "",
  ].join("");
  const { html, attachments } = renderLayout({ theme: t, preheader: `Your Tiny Humans session on ${formatLongDate(d.date)} is booked.`, body, images: opts.images ?? "cid" });
  const text = textLines([
    `You're booked, ${first}!`,
    "",
    `Reference: ${d.reference}`,
    `Bundle: ${d.bundle.name}`,
    `Date: ${formatLongDate(d.date)}`,
    `Time: ${time}`,
    `Location: ${formatAddress(d.address)}`,
    `Package total: ${formatPrice(d.bundle.price)}`,
    `Payment due: After the photoshoot`,
    "",
    PAYMENT_NOTE.email,
    "",
    "Our sessions are baby-led. Time is allowed for feeding, changing and comforting your little one whenever needed.",
    "If you need to make a change to your session, reply to this email.",
    opts.rescheduleUrl && opts.rescheduleNoticeHours !== undefined && `\n${rescheduleNoticeText(opts.rescheduleNoticeHours)}`,
    opts.rescheduleUrl && `Need a different time? ${opts.rescheduleUrl}`,
    opts.cancelUrl && `Need to cancel? ${opts.cancelUrl}`,
    "",
    `Tiny Humans · ${site.contact.email}`,
  ]);
  return { subject: `Your Tiny Humans session is booked (${d.reference}): ${formatLongDate(d.date)}, ${formatTimeLabel(d.start)}`, html, text, attachments };
}
