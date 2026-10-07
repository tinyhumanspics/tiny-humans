"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bundle } from "@/config/bundles";
import { bookingRules } from "@/config/booking";
import { IS_PROTOTYPE } from "@/lib/admin/client";
import { todayInZone } from "@/lib/booking/timezone";
import { sortBundles } from "@/lib/pricing/catalog";
import { PRICING_EVENT, readPrototypePricing } from "@/lib/pricing/prototype";

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
}

const CatalogContext = createContext<Ctx | null>(null);

/** Central bundle/price data for every customer-facing page (from Neon; browser storage in the prototype). */
export function CatalogProvider({ initial, status = "live", initialToday, children }: { initial: Bundle[]; status?: "live" | "snapshot" | "builtin"; initialToday: string; children: ReactNode }) {
  const [all, setAll] = useState<Bundle[]>(initial);
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    // the page may be cached: always re-check the date so expired offers disappear
    setToday(todayInZone(bookingRules.timeZone));
    if (!IS_PROTOTYPE) return;
    const load = () => setAll(readPrototypePricing().bundles);
    load();
    window.addEventListener(PRICING_EVENT, load);
    return () => window.removeEventListener(PRICING_EVENT, load);
  }, []);
  const value = useMemo<Ctx>(() => {
    const bundles = sortBundles(all.filter((b) => b.active !== false));
    return { bundles, getBundle: (id) => bundles.find((b) => b.id === id), today, available: bundles.length > 0, status };
  }, [all, today, status]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Ctx {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("useCatalog must be used inside CatalogProvider");
  return c;
}
