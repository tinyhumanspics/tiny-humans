"use client";

import type { AppLocale } from "@/i18n/config";
import type en from "@/messages/en.json";
import { useCatalog } from "@/components/providers/CatalogProvider";
import ChalkDoodle from "@/components/chalk/ChalkDoodle/ChalkDoodle";
import { formatLongDate } from "@/lib/booking/dates";
import { promoLine, promoSummary } from "@/lib/pricing/promo";
import styles from "./OfferLine.module.css";
import { cn } from "@/lib/cn";

/**
 * "Thanksgiving offer: 10% off every bundle. Book by November 30, 2026." under the Bundles heading (/bundles and the
 * ad landing page) while special offers run; nothing when there are none (the page looks exactly as before).
 */
export default function OfferLine({ messages, locale }: { messages: typeof en.bundlesPage.promo; locale: AppLocale }) {
  const { bundles, today } = useCatalog();
  const summary = promoSummary(bundles, today);
  if (!summary) return null;
  const list = (names: string[]) => new Intl.ListFormat(locale === "es" ? "es" : "en", { type: "conjunction" }).format(names);
  const date = (key: string) => formatLongDate(key, locale).replace(/^[^,]+, /, "");
  return (
    <p className={cn(styles.line, "chalk-soft")} data-offer-line="">
      <ChalkDoodle grain={false} name="star" size={22} color="var(--sun-yellow)" fill="var(--sun-yellow)" strokeWidth={2} className={styles.star} />
      <span>{promoLine(summary, messages, list, date)}</span>
    </p>
  );
}
