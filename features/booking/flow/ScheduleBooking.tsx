"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { findPhoto, useSiteSettings } from "@/components/providers/SiteSettingsProvider";
import { useBookingSelection } from "./BookingSelectionContext";
import Booking from "./Booking";
import DepositReturn from "./DepositReturn";
import { pendingDepositReturn } from "@/lib/booking/deposit-return";
import BookingPaused from "@/features/booking/BookingPaused";
import { bundlesHref, scheduleHref } from "@/config/booking";
import { lastBundle, rememberBundle } from "@/lib/booking/last-bundle";
import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import styles from "./Booking.module.css";
import type { DueLink } from "./useBookingFlow";
import type { DueSummary } from "@/lib/due-date/types";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/**
 * Reads ?bundle= and ?inspiration= from the link, then shows the calendar.
 * No (known) bundle in the link: back to the bundle opened earlier in this visit, otherwise to the bundles page.
 */
export default function ScheduleBooking({ locale = "en", messages, pausedMessages }: { locale?: AppLocale; messages: typeof en.bookingFlow; pausedMessages: typeof en.bundlesPage.paused }) {
  const params = useSearchParams();
  const router = useRouter();
  const { photos } = useSiteSettings();
  const { setInspirationId } = useBookingSelection();
  const { getBundle, available } = useCatalog();
  const bundle = getBundle(params.get("bundle"));
  const bundleId = bundle?.id;
  const inspirationId = params.get("inspiration");
  // back from the deposit's Stripe page (signed link to this booking's status)
  const depositRef = params.get("deposit");
  const depositSig = params.get("k");
  const redirected = useRef(false);
  // "Not born yet": the schedule link from a due-date reservation's email (?due=<token>)
  const dueToken = params.get("due");
  const [due, setDue] = useState<{ token: string; link: DueLink | null } | null>(null);
  useEffect(() => {
    if (!dueToken) return;
    let live = true;
    fetch(`/api/booking/due?token=${encodeURIComponent(dueToken)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { due?: DueSummary } | null) => live && setDue({ token: dueToken, link: j?.due ? { token: dueToken, summary: j.due } : null }))
      .catch(() => live && setDue({ token: dueToken, link: null }));
    return () => {
      live = false;
    };
  }, [dueToken]);

  // Waiting on a deposit in this tab (Back from Stripe, or /book opened again): show that booking, not a fresh form
  // where its own held time would look taken. Also when the browser restores the page from its back/forward cache.
  useEffect(() => {
    if (depositRef) return;
    const resume = () => {
      const path = pendingDepositReturn();
      if (path) router.replace(path);
    };
    resume();
    const onShow = (e: PageTransitionEvent) => e.persisted && resume();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [depositRef, router]);

  useEffect(() => {
    if (inspirationId && findPhoto(photos, inspirationId)) setInspirationId(inspirationId);
  }, [inspirationId, photos, setInspirationId]);

  useEffect(() => {
    if (bundleId) {
      rememberBundle(bundleId);
      redirected.current = false;
      return;
    }
    if (!available || redirected.current) return;
    redirected.current = true;
    const last = getBundle(lastBundle());
    router.replace(last ? scheduleHref(last.id, inspirationId, locale) : bundlesHref(inspirationId, locale));
  }, [bundleId, available, getBundle, inspirationId, locale, router]);

  if (!bundle && !available) {
    return (
      <section className={styles.section}>
        <div className="container">
          <BookingPaused messages={pausedMessages} />
        </div>
      </section>
    );
  }
  // on its way to the right page (see above)
  if (!bundle) return null;
  if (depositRef && depositSig) return <DepositReturn key={depositRef} bundleId={bundle.id} reference={depositRef} signature={depositSig} paid={params.get("paid") === "1"} locale={locale} messages={messages} />;
  if (dueToken) {
    if (due?.token !== dueToken) return null; // checking the link
    if (!due.link || due.link.summary.bundleId !== bundle.id) {
      return (
        <section className={styles.section}>
          <div className="container">
            <p className={cn(styles.error, "chalk-soft")} role="alert">{fill(messages.due.used, { phone: site.contact.phone })}</p>
          </div>
        </section>
      );
    }
    return <Booking key={`${bundle.id}-due`} bundleId={bundle.id} locale={locale} messages={messages} due={due.link} />;
  }
  // key: a different bundle starts a fresh booking
  return <Booking key={bundle.id} bundleId={bundle.id} locale={locale} messages={messages} />;
}
