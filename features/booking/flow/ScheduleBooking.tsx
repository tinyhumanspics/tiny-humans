"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import RequestFlow, { type RequestFlowMessages } from "@/features/booking/request/RequestFlow";
import { babyAgeOptions } from "@/config/booking";
import { site } from "@/config/site";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import type { BookingLinkSummary } from "@/lib/booking-links/types";
import type { DueSummary } from "@/lib/due-date/types";
import type en from "@/messages/en.json";
import { useBookingSelection } from "./BookingSelectionContext";
import DepositReturn from "./DepositReturn";
import InspirationBanner from "./InspirationBanner";
import styles from "./Booking.module.css";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/**
 * /book (brief 02): the request flow (when → your details → request sent), for ?bundle= or a bundle picked on screen.
 * It also opens the two links families get from us:
 * - ?deposit=<reference>&k=<signature>: a booking the owner made (Requests): the deposit first, then their home,
 *   ages and backdrops (decision #22);
 * - ?due=<token>: a due-date reservation's schedule link: the request flow for its bundle, kept price and details;
 * - ?link=<token>: the owner's booking link (owner, Nov 19): the request flow filled in with the session they agreed.
 * ?inspiration=<photo id> (a portfolio photo) shows at the top and goes with the request.
 */
export default function ScheduleBooking({ locale = "en", messages, request, inspiration, freeMiles, noticeHours }: { locale?: AppLocale; messages: typeof en.bookingFlow; request: RequestFlowMessages; inspiration: typeof en.bundlesPage.inspiration; freeMiles: number | null; noticeHours: number }) {
  const params = useSearchParams();
  const { photos } = useSiteSettings();
  const { setInspirationId } = useBookingSelection();
  const { getBundle } = useCatalog();
  const bundle = getBundle(params.get("bundle"));
  const inspirationId = params.get("inspiration");
  const depositRef = params.get("deposit");
  const depositSig = params.get("k");
  const dueToken = params.get("due");
  const [due, setDue] = useState<{ token: string; summary: DueSummary | null } | null>(null);
  const linkToken = params.get("link");
  const [link, setLink] = useState<{ token: string; summary: BookingLinkSummary | null } | null>(null);

  useEffect(() => {
    if (!linkToken) return;
    let live = true;
    fetch(`/api/booking/link?token=${encodeURIComponent(linkToken)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { link?: BookingLinkSummary } | null) => live && setLink({ token: linkToken, summary: j?.link ?? null }))
      .catch(() => live && setLink({ token: linkToken, summary: null }));
    return () => {
      live = false;
    };
  }, [linkToken]);

  useEffect(() => {
    if (!dueToken) return;
    let live = true;
    fetch(`/api/booking/due?token=${encodeURIComponent(dueToken)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { due?: DueSummary } | null) => live && setDue({ token: dueToken, summary: j?.due ?? null }))
      .catch(() => live && setDue({ token: dueToken, summary: null }));
    return () => {
      live = false;
    };
  }, [dueToken]);

  useEffect(() => {
    if (inspirationId && findPhoto(photos, inspirationId)) setInspirationId(inspirationId);
  }, [inspirationId, photos, setInspirationId]);

  if (bundle && depositRef && depositSig) return <DepositReturn key={depositRef} bundleId={bundle.id} reference={depositRef} signature={depositSig} paid={params.get("paid") === "1"} locale={locale} messages={messages} />;
  const flow = (dueLink?: { token: string; summary: DueSummary }, ownerLink?: { token: string; summary: BookingLinkSummary; babyLines: string[] }) => (
    <>
      <InspirationBanner messages={inspiration} />
      <RequestFlow locale={locale} messages={request} freeMiles={freeMiles} noticeHours={noticeHours} due={dueLink} link={ownerLink} />
    </>
  );
  const notValid = (text: string) => (
    <section className={styles.section}>
      <div className="container">
        <p className={cn(styles.error, "chalk-soft")} role="alert">
          {fill(text, { phone: site.contact.phone })}
        </p>
      </div>
    </section>
  );
  if (linkToken) {
    if (link?.token !== linkToken) return null; // checking the link
    if (!link.summary) return notValid(request.request.link.used);
    // "For Mia · Girl · Newborn (0–2 weeks)", in the page's language
    const ages = messages.details.baby.ageOptions;
    const babyLines = link.summary.babies.map((b) => {
      const age = [b.gender ? messages.details.baby.genders[b.gender] : "", ages[babyAgeOptions.indexOf(b.age as (typeof babyAgeOptions)[number])] ?? b.age].filter(Boolean).join(" · ");
      return b.name ? fill(request.request.link.baby, { name: b.name, age }) : fill(request.request.link.babyNoName, { age });
    });
    return flow(undefined, { token: link.token, summary: link.summary, babyLines });
  }
  if (!dueToken) return flow();
  if (due?.token !== dueToken) return null; // checking the link
  if (!due.summary) return notValid(messages.due.used);
  return flow({ token: due.token, summary: due.summary });
}
