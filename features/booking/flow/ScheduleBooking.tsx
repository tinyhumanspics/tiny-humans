"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import RequestFlow, { type RequestFlowMessages } from "@/features/booking/request/RequestFlow";
import { site } from "@/config/site";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";
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
 * - ?deposit=<reference>&k=<signature>: a booking the owner made (Requests or "Book it for them"): backdrops, then the
 *   deposit, then its status;
 * - ?due=<token>: a due-date reservation's schedule link: the request flow for its bundle, kept price and details.
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
  const flow = (link?: { token: string; summary: DueSummary }) => (
    <>
      <InspirationBanner messages={inspiration} />
      <RequestFlow locale={locale} messages={request} freeMiles={freeMiles} noticeHours={noticeHours} due={link} />
    </>
  );
  if (!dueToken) return flow();
  if (due?.token !== dueToken) return null; // checking the link
  if (!due.summary) {
    return (
      <section className={styles.section}>
        <div className="container">
          <p className={cn(styles.error, "chalk-soft")} role="alert">
            {fill(messages.due.used, { phone: site.contact.phone })}
          </p>
        </div>
      </section>
    );
  }
  return flow({ token: due.token, summary: due.summary });
}
