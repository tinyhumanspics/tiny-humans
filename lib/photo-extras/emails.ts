import "server-only";
import { site } from "@/config/site";
import type { Booking, PhotoExtraOrder } from "@/lib/db/schema";
import { internalPhotoExtrasEmail, photoExtrasPaidEmail } from "@/lib/email";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { getSiteSettings } from "@/lib/settings/server";
import en from "@/messages/en.json";
import { deliveryText, lineName } from "./format";
import type { ExtraLine } from "./types";

/**
 * Once photo extras are paid (owner, Nov 20): the family's thank-you (what they added, when it arrives; the active
 * seasonal theme) and the studio's "New photo extras" notice. Each is sent once per order.
 */
export async function sendExtrasPaidEmails(row: Booking, order: PhotoExtraOrder): Promise<void> {
  const lines = order.lines as ExtraLine[];
  const themeId = await getSiteSettings().then((s) => s.themeId).catch(() => "default");
  const family = await photoExtrasPaidEmail(
    { reference: row.bookingReference, parentName: row.parentName, babyName: row.babyName, bundleName: row.packageName },
    { themeId, lines, creditCents: order.creditCents, totalCents: order.totalCents, locale: row.locale },
  );
  const studio = await internalPhotoExtrasEmail({
    reference: row.bookingReference,
    parentName: row.parentName,
    email: row.email,
    phone: row.phone,
    bundleName: row.packageName,
    lines: lines.map((l) => ({ name: lineName(l, en.extras), amountCents: l.totalCents, when: l.delivery.withGallery ? "with their finished gallery" : deliveryText(l.delivery, en.extras) })),
    creditCents: order.creditCents,
    totalCents: order.totalCents,
    note: order.note,
    leadsUrl: `${site.url.replace(/\/$/, "")}/admin/leads`,
  });
  const cfg = emailConfig();
  await Promise.all([
    sendEmail({ scope: "resend.extras_paid", to: row.email, subject: family.subject, html: family.html, text: family.text, attachments: family.attachments, replyTo: cfg.notify, idempotencyKey: `extras-paid/${order.id}`, reference: row.bookingReference }),
    sendEmail({ scope: "resend.internal", from: cfg.internalFrom, to: cfg.notify, subject: studio.subject, html: studio.html, text: studio.text, replyTo: row.email, idempotencyKey: `extras-paid-studio/${order.id}`, reference: row.bookingReference }),
  ]);
}
