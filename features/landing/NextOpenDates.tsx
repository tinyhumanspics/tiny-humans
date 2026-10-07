"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/Catalog/CatalogProvider";
import { addDaysKey } from "@/lib/booking/timezone";
import { fromDateKey } from "@/lib/booking/dates";
import styles from "./Landing.module.css";

/** The real next open days (from the live calendar): honest urgency, no countdown timers. */
export default function NextOpenDates({ bundleId, label, loading }: { bundleId?: string; label: string; loading: string }) {
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
    <p className={`${styles.nextDates} chalk-soft`} aria-live="polite">
      <span className={styles.nextLabel}>{label}:</span>{" "}
      {days === null
        ? loading
        : days.map((d) => fromDateKey(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })).join(" · ")}
    </p>
  );
}
