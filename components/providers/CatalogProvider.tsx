"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Bundle } from "@/lib/pricing/types";
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

/** The clock has no change event to subscribe to: the date is read on each render. */
const noSubscription = () => () => {};

/** Central bundle/price data for every customer-facing page (from Neon). */
export function CatalogProvider({ initial, status = "live", initialToday, deposits = null, children }: { initial: Bundle[]; status?: "live" | "snapshot" | "builtin"; initialToday: string; deposits?: Record<string, number> | null; children: ReactNode }) {
  const all = initial;
  // the page may be cached: the browser re-checks the studio date so expired offers disappear
  const today = useSyncExternalStore(noSubscription, () => todayInZone(bookingRules.timeZone), () => initialToday);
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
