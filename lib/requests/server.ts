import "server-only";
import { bookingRules } from "@/config/booking";
import { site } from "@/config/site";
import { internalNewRequestEmail } from "@/emails/Internal";
import { requestReceivedEmail } from "@/emails/RequestReceived";
import { formatLongDate } from "@/lib/booking/dates";
import { BookingError } from "@/lib/booking/errors";
import { getBookingProvider } from "@/lib/booking/server";
import { tripConflict, tripSessions, visitorForZip } from "@/lib/booking/trips-server";
import { todayInZone, zonedTimeToUtc } from "@/lib/booking/timezone";
import type { BookingRequestRow } from "@/lib/db/schema";
import { depositOfferFor } from "@/lib/deposit/server";
import { dueByToken } from "@/lib/due-date/server";
import { dueWindow } from "@/lib/due-date/types";
import { emailConfig, sendEmail } from "@/lib/email/resend";
import { fill } from "@/lib/email/messages";
import { log } from "@/lib/log";
import { getPublicCatalog } from "@/lib/pricing/server";
import { getSiteSettings } from "@/lib/settings/server";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { holdUntil } from "./holds";
import { onRequestCreated } from "./hooks";
import { findByClientId, insertRequest } from "./store";
import { TEXT_CONSENT_VERSION, formatUsMobile, usMobile, type RequestSent } from "./types";
import type { ValidRequest } from "./validation";
import type { Attribution } from "@/lib/tracking/attribution";
import type { MetaClient } from "@/lib/tracking/meta-capi";

/** "TH-R-20261114-4821": shown to the owner and in the parent's email. */
export function requestReference(now = new Date()): string {
  const n = new Uint16Array(1);
  globalThis.crypto.getRandomValues(n);
  return `TH-R-${todayInZone(bookingRules.timeZone, now).replaceAll("-", "")}-${String(1000 + (n[0] % 9000))}`;
}

const sentOf = (r: BookingRequestRow): RequestSent => ({
  reference: r.reference,
  firstName: r.firstName,
  mobile: formatUsMobile(r.mobile),
  type: r.type === "due_date" ? "due_date" : "date",
  ...(r.slotDate && r.slotStart ? { slot: { date: r.slotDate, start: r.slotStart } } : {}),
  ...(r.dueDate ? { dueDate: r.dueDate } : {}),
});

/** Where the family came from and their browser (brief 03), read from the request's cookies and headers. */
export interface RequestSource {
  firstTouch?: Attribution | null;
  lastTouch?: Attribution | null;
  client?: MetaClient;
}

const sourceValues = ({ firstTouch, lastTouch, client }: RequestSource) => {
  const ids = lastTouch?.adId || lastTouch?.campaignId ? lastTouch : firstTouch;
  return {
    firstTouch: firstTouch ?? null,
    lastTouch: lastTouch ?? null,
    adId: ids?.adId ?? null,
    adsetId: ids?.adsetId ?? null,
    campaignId: ids?.campaignId ?? null,
    fbp: client?.fbp?.slice(0, 200) || null,
    fbc: client?.fbc?.slice(0, 600) || null,
    clientIp: client?.ip?.slice(0, 64) || null,
    userAgent: client?.userAgent?.slice(0, 500) || null,
  };
};

/**
 * "Send request" (brief 02): re-checks the time (or the due date), prices it like the booking form, saves it with a
 * 12-hour hold (Baby is here), emails the owner and the parent, and calls onRequestCreated. Nothing is paid here.
 * The same clientId again (double tap, retry) returns the first request.
 */
export async function createRequest(r: ValidRequest, source: RequestSource = {}, now = new Date()): Promise<{ sent: RequestSent; row: BookingRequestRow; created: boolean; lead: boolean }> {
  const existing = await findByClientId(r.clientId);
  if (existing) return { sent: sentOf(existing), row: existing, created: false, lead: false };
  const messages = r.locale === "es" ? es : en;
  const provider = getBookingProvider();

  // sent from a due-date reservation's schedule link: that reservation's bundle, babies and kept price
  const due = r.dueToken ? await dueByToken(r.dueToken) : null;
  if (r.dueToken && (!due || due.status !== "reserved" || due.packageId !== r.bundleId || r.type !== "date")) {
    throw new BookingError("invalid_request", fill(messages.bookingFlow.due.used, { phone: site.contact.phone }));
  }
  const babyCount = due?.babyCount ?? r.babyCount;

  // price: the bundle (with any running offer) + extra babies, exactly like the booking form; never from the browser
  const pricing = await provider.quote(r.bundleId, undefined, r.email, babyCount, 0, r.dueToken);

  // the home: Florida only, and not farther than the owner's limit (those families text instead)
  const travel = travelQuote(r.zip, await getTravelSettings());
  if (travel.status === "outside_florida") throw new BookingError("invalid_request", messages.bookingFlow.details.travel.outsideFlorida);
  if (travel.status === "too_far") throw new BookingError("invalid_request", fill(messages.bookingFlow.details.travel.tooFar, { phone: site.contact.phone }));

  let when: { slotDate: string; slotStart: string; startsAt: Date; endsAt: Date; holdUntil: Date } | { dueDate: string };
  if (r.type === "date") {
    const slot = r.slot!;
    // trip days: this home against the day's other sessions (an Orlando home and a Miami Beach one on the same day)
    if (tripConflict(slot.date, slot.start, await visitorForZip(r.zip), await tripSessions(slot.date, slot.date, undefined, now))) {
      throw new BookingError("slot_unavailable", fill(messages.bookingFlow.errors.tripDay, { phone: site.contact.phone }), "trip_day");
    }
    // the time is still open for this bundle and baby count (Outlook, bookings and other families' request holds)
    const [day] = await provider.getAvailability({ bundleId: r.bundleId, babyCount, from: slot.date, to: slot.date, zip: r.zip });
    const open = day?.slots.find((s) => s.start === slot.start);
    if (!open) throw new BookingError("slot_unavailable", messages.bookingRequest.details.errors.slotTaken);
    const tz = bookingRules.timeZone;
    when = { slotDate: slot.date, slotStart: slot.start, startsAt: zonedTimeToUtc(slot.date, slot.start, tz), endsAt: zonedTimeToUtc(slot.date, open.end, tz), holdUntil: holdUntil(now) };
  } else {
    const window = dueWindow(todayInZone(bookingRules.timeZone, now));
    if (!r.dueDate || r.dueDate < window.from || r.dueDate > window.to) throw new BookingError("invalid_request", fill(messages.bookingRequest.when.dueWindow, { date: formatLongDate(window.to, r.locale) }));
    when = { dueDate: r.dueDate };
  }

  const values = {
    reference: requestReference(now),
    clientId: r.clientId,
    locale: r.locale,
    type: r.type,
    status: "new",
    bundleId: pricing.bundleId,
    bundleName: pricing.bundleName,
    babyCount,
    bundleCents: pricing.finalCents,
    addonsCents: pricing.addonsCents,
    totalCents: pricing.totalCents,
    pricing,
    ...when,
    firstName: r.firstName.trim(),
    mobile: usMobile(r.mobile)!,
    email: r.email,
    zip: r.zip,
    travelStatus: travel.status,
    travelMiles: travel.miles,
    travelFeeCents: travel.feeCents,
    textConsent: r.textConsent,
    consentVersion: TEXT_CONSENT_VERSION,
    dueId: due?.id ?? null,
    inspirationId: r.inspiration || null,
    ...sourceValues(source),
  };
  let row: BookingRequestRow;
  try {
    row = await insertRequest(values, now);
  } catch (err) {
    // the same submission arriving twice at once: the first one wins
    const again = await findByClientId(r.clientId).catch(() => null);
    if (again) return { sent: sentOf(again), row: again, created: false, lead: false };
    throw err;
  }
  log.info("requests", "Request saved", { reference: row.reference, type: row.type });
  const { lead } = await onRequestCreated(row);
  return { sent: sentOf(row), row, created: true, lead };
}

/** The owner's "new request" email and the parent's "request received" (best effort: the request is already saved). */
export async function sendRequestEmails(row: BookingRequestRow): Promise<void> {
  const base = site.url.replace(/\/$/, "");
  try {
    const owner = await internalNewRequestEmail(row, `${base}/admin/requests`);
    await sendEmail({ scope: "resend.request_owner", from: emailConfig().internalFrom, to: emailConfig().notify, subject: owner.subject, html: owner.html, text: owner.text, replyTo: row.email, idempotencyKey: `request-owner/${row.id}`, reference: row.reference });
  } catch (err) {
    log.error("requests", "Owner request email not sent", { reference: row.reference, error: err as Error });
  }
  try {
    const locale = row.locale === "es" ? "es" : "en";
    const bundleName = (await getPublicCatalog(locale).catch(() => null))?.bundles.find((b) => b.id === row.bundleId)?.name ?? row.bundleName;
    const themeId = await getSiteSettings()
      .then((s) => s.themeId)
      .catch(() => "default");
    const mail = await requestReceivedEmail(row, { themeId, locale, bundleName, depositCents: row.dueId ? null : await depositOfferFor(row.bundleId) });
    await sendEmail({ scope: "resend.request_received", to: row.email, subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments, replyTo: emailConfig().notify, idempotencyKey: `request-received/${row.id}`, reference: row.reference });
  } catch (err) {
    log.error("requests", "Request received email not sent", { reference: row.reference, error: err as Error });
  }
}
