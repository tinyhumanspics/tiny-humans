import { site } from "@/config/site";
import { formatPrice } from "@/config/bundles";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { PAYMENT_NOTE, type RescheduleDetails } from "@/lib/booking/templates";
import { button, chalkBox, details, heading, paragraph, renderLayout, textLines } from "../layout";
import { emailTheme } from "../theme";
import type { ImageMode, RenderedEmail } from "../types";

/** Customer reschedule confirmation (active website theme, new manage links). */
export function bookingRescheduledEmail(r: RescheduleDetails, opts: { themeId: string; manage?: { reschedule: string; cancel: string }; images?: ImageMode }): RenderedEmail {
  const t = emailTheme(opts.themeId);
  const first = r.parentName.split(" ")[0];
  const oldT = `${formatTimeLabel(r.oldStart)} to ${formatTimeLabel(r.oldEnd)}`;
  const newT = `${formatTimeLabel(r.newStart)} to ${formatTimeLabel(r.newEnd)}`;
  const message = "Your Tiny Humans session has been successfully rescheduled. We've updated your appointment and can't wait to capture these little moments with you.";
  const body = [
    heading(t, "Booking rescheduled", `All set, ${first}!`),
    paragraph(t, message, { align: "center" }),
    details(t, [
      ["Reference", r.reference],
      ["Bundle", r.bundleName],
      ["Previous", `${formatLongDate(r.oldDate)}\n${oldT}`],
      ["New date", formatLongDate(r.newDate)],
      ["New time", newT],
      ["Location", r.location],
      ["Package total", formatPrice(r.packagePrice)],
    ]),
    chalkBox(t, "Payment", [["Package total", formatPrice(r.packagePrice)], ["Payment due", "After the photoshoot"]], PAYMENT_NOTE.email),
    opts.manage ? button(t, "Reschedule Booking", opts.manage.reschedule, "outline") : "",
    opts.manage ? button(t, "Cancel Booking", opts.manage.cancel, "outline", "These links replace the ones in earlier emails.") : "",
    paragraph(t, "Questions? Just reply to this email.", { align: "center", muted: true }),
  ].join("");
  const { html, attachments } = renderLayout({ theme: t, preheader: `Your session is now on ${formatLongDate(r.newDate)} at ${formatTimeLabel(r.newStart)}.`, body, images: opts.images ?? "cid" });
  const text = textLines([
    `Hi ${first},`,
    "",
    message,
    "",
    `Reference: ${r.reference}`,
    `Bundle: ${r.bundleName}`,
    `Previous: ${formatLongDate(r.oldDate)}, ${oldT}`,
    `New: ${formatLongDate(r.newDate)}, ${newT}`,
    `Location: ${r.location}`,
    `Package total: ${formatPrice(r.packagePrice)}`,
    "Payment due: After the photoshoot",
    "",
    opts.manage && `Reschedule: ${opts.manage.reschedule}`,
    opts.manage && `Cancel: ${opts.manage.cancel}`,
    `Tiny Humans · ${site.contact.email}`,
  ]);
  return { subject: `Your Tiny Humans session has been rescheduled — ${r.reference}`, html, text, attachments };
}
