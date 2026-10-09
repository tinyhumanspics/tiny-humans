"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Bundle } from "@/config/bundles";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkBox from "@/components/ChalkBox/ChalkBox";
import ChalkButton from "@/components/ChalkButton/ChalkButton";
import ChalkDoodle from "@/components/ChalkDoodle/ChalkDoodle";
import { formatLongDate, formatTimeLabel, type BookingResult } from "@/lib/booking";
import { backdropNames } from "@/lib/booking/backdrop-names";
import { bookingBabiesLabel, bookingPricingRows } from "@/lib/booking/customer-page-format";
import { changePolicyText } from "@/lib/booking/reschedule-policy";
import { formatAddress } from "@/lib/booking/templates";
import { fill } from "@/lib/email/messages";
import { paymentDue } from "@/lib/email/payment";
import { formatMoney, toCents } from "@/lib/pricing/engine";
import { travelFeeValue } from "@/lib/travel/format";
import type { BookingTravel } from "@/lib/travel/types";
import { cn } from "@/lib/cn";
import InspirationThumb from "./InspirationThumb";
import styles from "./Booking.module.css";
import { babyNames } from "@/lib/booking/extra-babies";
import type { EmailLocale } from "@/lib/email";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";

/** The booking is confirmed: details, payment, what's next (also shown after the deposit's Stripe page). */
export default function Confirmation({
  result,
  headingRef,
  onReset,
  travelEstimate,
  locale,
  messages,
}: {
  result: BookingResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
  /** The estimate shown while booking (mock mode has no server travel fee). */
  travelEstimate?: BookingTravel;
  locale: AppLocale;
  messages: typeof en.bookingFlow;
}) {
  const r = result.request;
  const travel = result.travel ?? travelEstimate;
  const travelFee = travel?.feeCents ?? 0;
  const { getBundle } = useCatalog();
  const bundle = getBundle(r.bundleId);
  const price = result.pricing;
  const babies = r.babies ?? [{ name: r.contact.babyName, age: r.contact.babyAge }];
  const firstName = r.contact.parentName.split(" ")[0];
  // "After the photoshoot", or the deposit paid while booking and the rest
  const dep = result.deposit;
  const due = paymentDue(locale, (price?.totalCents ?? price?.finalCents ?? (bundle ? toCents(bundle.price) : 0)) + travelFee, dep && dep.status !== "pending" ? { amountCents: dep.amountCents, status: dep.status } : undefined);
  const { photos } = useSiteSettings();
  const inspiration = findPhoto(photos, r.inspirationPhotoId);
  const priceRows = price
    ? bookingPricingRows(price, bundle ?? { offer: null }, messages.review)
    : ([[messages.review.labels.bundleTotal, bundle ? formatMoney(toCents(bundle.price)) : ""]] as [string, string][]);
  const names = babyNames(babies, messages.review.and);
  const details: [string, string][] = [
    [messages.confirmation.labels.reference, result.id],
    [messages.confirmation.labels.bundle, bundle?.name ?? price?.bundleName ?? ""],
    [messages.confirmation.labels.date, formatLongDate(r.slot.date, locale)],
    [messages.confirmation.labels.time, fill(messages.review.timeRange, { start: formatTimeLabel(r.slot.start, locale), end: formatTimeLabel(r.slot.end, locale), zone: messages.time.zone })],
    [messages.confirmation.labels.location, formatAddress(r.address, messages.review.unit)],
    [babies.length > 1 ? messages.review.labels.babies : messages.review.labels.baby, bookingBabiesLabel(babies, messages.details)],
    ...(r.backdrops?.length ? [[r.backdrops.length > 1 ? messages.review.labels.backdrops : messages.review.labels.backdrop, backdropNames(r.backdrops, messages.details.backdrops.names, messages.review.and)] as [string, string]] : []),
    ...priceRows,
    ...(travelFee > 0 && price
      ? ([
          [messages.details.travel.label, travelFeeValue(travelFee, travel?.miles ?? null, messages.details.travel)],
          [messages.details.travel.total, formatMoney(price.totalCents + travelFee)],
        ] as [string, string][])
      : []),
  ];
  return (
    <div className={styles.confirm} role="status">
      <ChalkDoodle name="heart" size={84} color="var(--sun-yellow)" strokeWidth={3} className={styles.confirmHeart} />
      <p className={cn(styles.confirmEyebrow, "chalk-soft")}>{messages.confirmation.eyebrow}</p>
      <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>
        {fill(messages.confirmation.title, { name: firstName })}
      </h3>
      <p className={cn(styles.confirmText, "chalk-soft")}>
        {fill(messages.confirmation.home, { city: r.address.city })}
        {names ? fill(messages.confirmation.namedBabies, { names }) : babies.length > 1 ? messages.confirmation.manyBabies : messages.confirmation.oneBaby}
      </p>
      <dl className={styles.confirmDetails}>
        {details.map(([k, v]) => (
          <div key={k} className={styles.confirmRow}>
            <dt className="chalk-soft">{k}</dt>
            <dd className="chalk-soft">{v}</dd>
          </div>
        ))}
      </dl>
      <ChalkBox className={styles.paymentBox} seed={93} wobble={2.4} strokeWidth={2.6} color="var(--sun-yellow)">
        <p className={cn(styles.paymentTitle, "chalk-soft")}>{messages.confirmation.labels.payment}</p>
        <dl className={styles.paymentRows}>
          {priceRows.map(([k, v]) => (
            <div key={k} className={styles.confirmRow}><dt className="chalk-soft">{k}</dt><dd className="chalk-soft">{v}</dd></div>
          ))}
          {travelFee > 0 && price && (
            <>
              <div className={styles.confirmRow}>
                <dt className="chalk-soft">{messages.details.travel.label}</dt>
                <dd className="chalk-soft">{travelFeeValue(travelFee, travel?.miles ?? null, messages.details.travel)}</dd>
              </div>
              <div className={styles.confirmRow}>
                <dt className="chalk-soft">{messages.details.travel.total}</dt>
                <dd className="chalk-soft">{formatMoney(price.totalCents + travelFee)}</dd>
              </div>
            </>
          )}
          {due.rows.map(([k, v]) => (
            <div key={k} className={styles.confirmRow}>
              <dt className="chalk-soft">{k}</dt>
              <dd className="chalk-soft">{v}</dd>
            </div>
          ))}
        </dl>
        <p className={cn(styles.paymentNote, "chalk-soft")}>{due.note}</p>
      </ChalkBox>
      {inspiration && (
        <div className={styles.chip}>
          <InspirationThumb photo={inspiration} size={52} />
          <p className="chalk-soft">
            <span className={styles.chipLabel}>{messages.confirmation.inspiration}</span> {inspiration.title}
          </p>
        </div>
      )}
      {result.rescheduleNoticeHours !== undefined && (
        <p className={cn(styles.rescheduleNote, "chalk-soft")}>
          {changePolicyText(result.rescheduleNoticeHours, messages.confirmation.policy)} {messages.confirmation.policyLinks}
        </p>
      )}
      {result.preview && <PrototypePreviews result={result} />}
      <ChalkBox className={styles.mockNote} seed={91} wobble={2} strokeWidth={2} color="var(--cloud-blue)" double={false}>
        <p className="chalk-soft">
          {result.status === "mock"
            ? messages.confirmation.prototype
            : result.emailSent
              ? fill(messages.confirmation.emailSent, { email: r.contact.email })
              : fill(messages.confirmation.emailSoon, { email: r.contact.email })}
        </p>
      </ChalkBox>
      <ChalkButton variant="outline" onClick={onReset} seed={92}>
        {messages.confirmation.bookAnother}
      </ChalkButton>
    </div>
  );
}


/* ---------------- prototype only: preview the email + the cancel link ---------------- */

function PrototypePreviews({ result }: { result: BookingResult }) {
  const { getBundle } = useCatalog();
  const router = useRouter();
  const { theme, photos } = useSiteSettings();
  const [preview, setPreview] = useState<{ html: string; locale: EmailLocale } | null>(null);
  const token = result.preview!.cancelToken;
  const cancelPath = `/cancel?t=${token}`;
  const reschedulePath = `/reschedule?t=${token}`;

  const openEmail = async (locale: EmailLocale) => {
    const { bookingConfirmationEmail } = await import("@/emails/BookingConfirmation");
    const r = result.request;
    const pricing = result.pricing!;
    const bundle = (getBundle(r.bundleId) ?? { id: r.bundleId, name: pricing.bundleName, price: pricing.regularCents / 100, duration: "", durationMinutes: 60, people: "", setups: "", photos: "", features: [], locationNote: "", cta: "" }) as Bundle;
    const mail = await bookingConfirmationEmail(
      { reference: result.id, bundle, pricing, date: r.slot.date, start: r.slot.start, end: r.slot.end, contact: r.contact, babies: r.babies ?? [{ name: r.contact.babyName, age: r.contact.babyAge }], address: r.address, inspirationTitle: findPhoto(photos, r.inspirationPhotoId)?.title },
      { themeId: theme.id, cancelUrl: cancelPath, rescheduleUrl: reschedulePath, rescheduleNoticeHours: result.rescheduleNoticeHours, images: "inline", locale },
    );
    setPreview({ html: mail.html, locale });
  };

  return (
    <div className={styles.previewBar}>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => openEmail("en")}>Preview the confirmation email</button>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => openEmail("es")}>Preview the Spanish email</button>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => router.push(reschedulePath)}>Try the Reschedule link</button>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => router.push(cancelPath)}>Try the Cancel Booking link</button>
      {preview && createPortal(
        <div className={styles.previewModal} role="dialog" aria-modal="true" aria-label="Confirmation email preview">
          <div className={styles.previewTop}>
            <p className="chalk-soft">{preview.locale === "es" ? "Spanish" : "English"} email preview ({theme.label} theme)</p>
            <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setPreview(null)}>Close</button>
          </div>
          <iframe
            title={`${preview.locale === "es" ? "Spanish" : "English"} confirmation email preview`}
            className={styles.previewFrame}
            srcDoc={preview.html}
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument;
              doc?.querySelectorAll("a").forEach((a) => {
                const href = a.getAttribute("href") ?? "";
                if (href.startsWith("/cancel") || href.startsWith("/reschedule")) {
                  a.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    setPreview(null);
                    router.push(href);
                  });
                } else {
                  a.setAttribute("target", "_blank");
                }
              });
            }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
