"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { addDaysKey } from "@/lib/booking/timezone";
import { formatShortDate } from "@/lib/booking/dates";
import type { AppLocale } from "@/i18n/config";
import styles from "./Landing.module.css";
import { cn } from "@/lib/cn";

/** The real next open days (from the live calendar): honest urgency, no countdown timers. */
export default function NextOpenDates({ bundleId, label, loading, locale = "en" }: { bundleId?: string; label: string; loading: string; locale?: AppLocale }) {
  const { today } = useCatalog();
  const [days, setDays] = useState<string[] | null>(null);

  useEffect(() => {
    if (!bundleId) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ bundle: bundleId, from: today, to: addDaysKey(today, 30) });
    fetch(`/api/booking/availability?${q}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { days: { date: string; slots: unknown[] }[] }) => setDays(d.days.filter((x) => x.slots.length).slice(0, 3).map((x) => x.date)))
      .catch(() => setDays([]));
    return () => ctrl.abort();
  }, [bundleId, today]);

  if (!bundleId || (days && days.length === 0)) return null;
  return (
    <p className={cn(styles.nextDates, "chalk-soft")} aria-live="polite">
      <span className={styles.nextLabel}>{label}:</span>{" "}
      {days === null
        ? loading
        : days.map((d) => formatShortDate(d, locale)).join(" · ")}
    </p>
  );
}
