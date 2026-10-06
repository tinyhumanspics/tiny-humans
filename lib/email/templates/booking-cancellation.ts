import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import type { CancellationDetails } from "@/lib/booking/templates";
import { button, details, heading, paragraph, renderLayout, textLines } from "../layout";
import { emailTheme } from "../theme";
import type { ImageMode, RenderedEmail } from "../types";

/** Customer cancellation confirmation (follows the active website theme). */
export function bookingCancellationEmail(c: CancellationDetails, opts: { themeId: string; images?: ImageMode }): RenderedEmail {
  const t = emailTheme(opts.themeId);
  const first = c.parentName.split(" ")[0];
  const time = `${formatTimeLabel(c.start)} to ${formatTimeLabel(c.end)}`;
  const bookUrl = `${site.url.replace(/\/$/, "")}/book`;
  const message =
    "Your Tiny Humans session has been cancelled. We're sorry we won't get to capture these little moments this time. If you'd like to book another session in the future, we'd love to see you.";
  const body = [
    heading(t, "Booking cancelled", `Your session has been cancelled`),
    paragraph(t, `Hi ${first},`, { align: "center" }),
    paragraph(t, message, { align: "center" }),
    details(t, [
      ["Name", c.parentName],
      ["Reference", c.reference],
      ["Bundle", c.bundleName],
      ["Original date", formatLongDate(c.date)],
      ["Original time", time],
      ["Reason", c.reason],
    ]),
    button(t, "Book another session", bookUrl, "solid"),
    paragraph(t, "Questions? Just reply to this email.", { align: "center", muted: true }),
  ].join("");
  const { html, attachments } = renderLayout({ theme: t, preheader: `Your Tiny Humans session (${c.reference}) has been cancelled.`, body, images: opts.images ?? "cid" });
  const text = textLines([
    `Hi ${first},`,
    "",
    message,
    "",
    `Reference: ${c.reference}`,
    `Bundle: ${c.bundleName}`,
    `Original date: ${formatLongDate(c.date)}`,
    `Original time: ${time}`,
    `Reason: ${c.reason}`,
    "",
    `Book another session: ${bookUrl}`,
    `Tiny Humans · ${site.contact.email}`,
  ]);
  return { subject: `Your Tiny Humans session has been cancelled — ${c.reference}`, html, text, attachments };
}
