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
import { changePolicyText } from "@/lib/booking/reschedule-policy";
import { formatAddress, pricingRows } from "@/lib/booking/templates";
import { paymentDue } from "@/lib/email/payment";
import { formatMoney, toCents } from "@/lib/pricing/engine";
import { travelFeeValue } from "@/lib/travel/format";
import type { BookingTravel } from "@/lib/travel/types";
import en from "@/messages/en.json";
import { cn } from "@/lib/cn";
import InspirationThumb from "./InspirationThumb";
import styles from "./Booking.module.css";
import { babiesLabel, babyNames } from "@/lib/booking/extra-babies";

/** The booking is confirmed: details, payment, what's next (also shown after the deposit's Stripe page). */
export default function Confirmation({
  result,
  headingRef,
  onReset,
  travelEstimate,
}: {
  result: BookingResult;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
  /** The estimate shown while booking (mock mode has no server travel fee). */
  travelEstimate?: BookingTravel;
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
  const due = paymentDue("en", (price?.totalCents ?? price?.finalCents ?? (bundle ? toCents(bundle.price) : 0)) + travelFee, dep && dep.status !== "pending" ? { amountCents: dep.amountCents, status: dep.status } : undefined);
  const { photos } = useSiteSettings();
  const inspiration = findPhoto(photos, r.inspirationPhotoId);
  const details: [string, string][] = [
    ["Booking reference", result.id],
    ["Bundle", price?.bundleName ?? bundle?.name ?? ""],
    ["Session date", formatLongDate(r.slot.date)],
    ["Session time", `${r.slot.label} to ${formatTimeLabel(r.slot.end)} (${en.booking.timeZone.short})`],
    ["Location", formatAddress(r.address)],
    [babies.length > 1 ? en.booking.extraBabies.review : "Baby", babiesLabel(babies)],
    ...(r.backdrops?.length ? [[r.backdrops.length > 1 ? en.booking.backdrops.reviewMany : en.booking.backdrops.review, backdropNames(r.backdrops)] as [string, string]] : []),
    ...(price ? pricingRows(price) : [["Bundle total", bundle ? formatMoney(toCents(bundle.price)) : ""]] as [string, string][]),
    ...(travelFee > 0 && price
      ? ([
          [en.booking.travel.label, travelFeeValue(travelFee, travel?.miles ?? null)],
          [en.booking.travel.total, formatMoney(price.totalCents + travelFee)],
        ] as [string, string][])
      : []),
  ];
  return (
    <div className={styles.confirm} role="status">
      <ChalkDoodle name="heart" size={84} color="var(--sun-yellow)" strokeWidth={3} className={styles.confirmHeart} />
      <p className={cn(styles.confirmEyebrow, "chalk-soft")}>Booking confirmed</p>
      <h3 ref={headingRef} tabIndex={-1} className={cn(styles.confirmTitle, "chalk")}>
        See you soon, {firstName}!
      </h3>
      <p className={cn(styles.confirmText, "chalk-soft")}>
        We&apos;ll bring the whole studio to your home in {r.address.city}.
        {babyNames(babies) ? ` We can't wait to meet ${babyNames(babies)}.` : babies.length > 1 ? " We can't wait to meet your little ones." : " We can't wait to meet your little one."}
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
        <p className={cn(styles.paymentTitle, "chalk-soft")}>Payment</p>
        <dl className={styles.paymentRows}>
          {(price ? pricingRows(price) : [["Bundle total", bundle ? formatMoney(toCents(bundle.price)) : ""]] as [string, string][]).map(([k, v]) => (
            <div key={k} className={styles.confirmRow}><dt className="chalk-soft">{k}</dt><dd className="chalk-soft">{v}</dd></div>
          ))}
          {travelFee > 0 && price && (
            <>
              <div className={styles.confirmRow}>
                <dt className="chalk-soft">{en.booking.travel.label}</dt>
                <dd className="chalk-soft">{travelFeeValue(travelFee, travel?.miles ?? null)}</dd>
              </div>
              <div className={styles.confirmRow}>
                <dt className="chalk-soft">{en.booking.travel.total}</dt>
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
            <span className={styles.chipLabel}>Inspiration saved:</span> {inspiration.title}
          </p>
        </div>
      )}
      {result.rescheduleNoticeHours !== undefined && (
        <p className={cn(styles.rescheduleNote, "chalk-soft")}>
          {changePolicyText(result.rescheduleNoticeHours)} The links are in your confirmation email.
        </p>
      )}
      {result.preview && <PrototypePreviews result={result} />}
      <ChalkBox className={styles.mockNote} seed={91} wobble={2} strokeWidth={2} color="var(--cloud-blue)" double={false}>
        <p className="chalk-soft">
          {result.status === "mock"
            ? `Prototype preview: no calendar event was created and no email was sent.`
            : result.emailSent
              ? `A confirmation email is on its way to ${r.contact.email}.`
              : `We'll email your confirmation to ${r.contact.email} shortly.`}
        </p>
      </ChalkBox>
      <ChalkButton variant="outline" onClick={onReset} seed={92}>
        Book another session
      </ChalkButton>
    </div>
  );
}


/* ---------------- prototype only: preview the email + the cancel link ---------------- */

function PrototypePreviews({ result }: { result: BookingResult }) {
  const { getBundle } = useCatalog();
  const router = useRouter();
  const { theme, photos } = useSiteSettings();
  const [html, setHtml] = useState<string | null>(null);
  const token = result.preview!.cancelToken;
  const cancelPath = `/cancel?t=${token}`;
  const reschedulePath = `/reschedule?t=${token}`;

  const openEmail = async () => {
    const { bookingConfirmationEmail } = await import("@/emails/BookingConfirmation");
    const r = result.request;
    const pricing = result.pricing!;
    const bundle = (getBundle(r.bundleId) ?? { id: r.bundleId, name: pricing.bundleName, price: pricing.regularCents / 100, duration: "", durationMinutes: 60, people: "", setups: "", photos: "", features: [], locationNote: "", cta: "" }) as Bundle;
    const mail = await bookingConfirmationEmail(
      { reference: result.id, bundle, pricing, date: r.slot.date, start: r.slot.start, end: r.slot.end, contact: r.contact, babies: r.babies ?? [{ name: r.contact.babyName, age: r.contact.babyAge }], address: r.address, inspirationTitle: findPhoto(photos, r.inspirationPhotoId)?.title },
      { themeId: theme.id, cancelUrl: cancelPath, rescheduleUrl: reschedulePath, rescheduleNoticeHours: result.rescheduleNoticeHours, images: "inline" },
    );
    setHtml(mail.html);
  };

  return (
    <div className={styles.previewBar}>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={openEmail}>Preview the confirmation email</button>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => router.push(reschedulePath)}>Try the Reschedule link</button>
      <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => router.push(cancelPath)}>Try the Cancel Booking link</button>
      {html && createPortal(
        <div className={styles.previewModal} role="dialog" aria-modal="true" aria-label="Confirmation email preview">
          <div className={styles.previewTop}>
            <p className="chalk-soft">Email preview ({theme.label} theme)</p>
            <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={() => setHtml(null)}>Close</button>
          </div>
          <iframe
            title="Confirmation email preview"
            className={styles.previewFrame}
            srcDoc={html}
            onLoad={(e) => {
              const doc = e.currentTarget.contentDocument;
              doc?.querySelectorAll("a").forEach((a) => {
                const href = a.getAttribute("href") ?? "";
                if (href.startsWith("/cancel") || href.startsWith("/reschedule")) {
                  a.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    setHtml(null);
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
