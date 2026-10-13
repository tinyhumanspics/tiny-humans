"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bundle } from "@/config/bundles";
import { bookingRules } from "@/config/booking";
import { todayInZone } from "@/lib/booking/timezone";
import { sortBundles } from "@/lib/pricing/catalog";

interface Ctx {
  /** Active bundles, in display order (what the public site shows). */
  bundles: Bundle[];
  getBundle: (id: string | null | undefined) => Bundle | undefined;
  /** Today in the studio time zone (offers are active through their end date). */
  today: string;
  /** False when there are no bookable bundles (booking shows a friendly pause message). */
  available: boolean;
  /** "snapshot" = Neon was unreachable and the last good copy is shown. */
  status: "live" | "snapshot" | "builtin";
  /** A bundle's deposit (cents) for the website's wording; null while deposits are off. */
  depositFor: (id: string) => number | null;
}

const CatalogContext = createContext<Ctx | null>(null);

/** Central bundle/price data for every customer-facing page (from Neon). */
export function CatalogProvider({ initial, status = "live", initialToday, deposits = null, children }: { initial: Bundle[]; status?: "live" | "snapshot" | "builtin"; initialToday: string; deposits?: Record<string, number> | null; children: ReactNode }) {
  const all = initial;
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    // the page may be cached: always re-check the date so expired offers disappear
    setToday(todayInZone(bookingRules.timeZone));
  }, []);
  const value = useMemo<Ctx>(() => {
    const bundles = sortBundles(all.filter((b) => b.active !== false));
    return { bundles, getBundle: (id) => bundles.find((b) => b.id === id), today, available: bundles.length > 0, status, depositFor: (id) => deposits?.[id] ?? null };
  }, [all, today, status, deposits]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Ctx {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("useCatalog must be used inside CatalogProvider");
  return c;
}
