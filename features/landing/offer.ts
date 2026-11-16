"use client";

import en from "@/messages/en.json";
import { scheduleHref } from "@/config/booking";
import { useCatalog } from "@/components/providers/CatalogProvider";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import { depositText, type SiteDeposit } from "@/lib/deposit/copy";
import { fill } from "@/lib/email/messages";
import { activeOffer, formatMoney, toCents } from "@/lib/pricing/engine";
import type { Bundle } from "@/lib/pricing/types";
import { trackSelectBundle } from "@/lib/tracking/client";
import type { TravelSettings } from "@/lib/travel/types";

/** What a family pays at least today: a bundle at its running offer if any. */
export const priceCents = (b: Bundle, today: string) => activeOffer(b, today)?.cents ?? toCents(b.price);

/**
 * The "Check dates" path of the ad page and the home page (the same page): the bundles shown there (switched on in /admin,
 * cheapest first), the middle one that "Check dates" opens, and the price line ("From $199 · $50 holds your date,
 * refundable up to 48 hours before · Free travel within 30 miles of Miami Beach"). Every amount comes from /admin.
 * `query`: the incoming link's parameters (utm, ad ids), kept on every "Check dates".
 */
export function useLandingOffer({
  noticeHours,
  travel,
  deposit,
  query = "",
  priceMessages = en.landing.price,
  noticeMessages = en.policy,
  locale = "en",
}: {
  noticeHours: number;
  travel: TravelSettings | null;
  deposit: SiteDeposit | null;
  query?: string;
  priceMessages?: typeof en.landing.price;
  noticeMessages?: Pick<typeof en.policy, "hour" | "hours">;
  locale?: AppLocale;
}) {
  const { bundles, today, available } = useCatalog();
  const notice = noticeLabel(noticeHours, noticeMessages);
  const shown = bundles.filter((b) => b.showOnLanding !== false).sort((a, b) => priceCents(a, today) - priceCents(b, today));
  const featured = shown[Math.floor((shown.length - 1) / 2)] ?? bundles[0];
  const withQuery = (href: string) => (query ? `${href}&${query}` : href);
  // "Check dates": /book with the middle bundle checked and every bundle side by side to compare (?compare=1)
  const ctaHref = featured ? withQuery(`${scheduleHref(featured.id, null, locale)}&compare=1`) : `${localePath("/book", locale)}${query ? `?${query}` : ""}`;
  const onCta = (b: Bundle | undefined = featured) => {
    if (b) trackSelectBundle({ id: b.id, name: b.name, value: priceCents(b, today) / 100 });
  };
  const lowest = shown.length ? Math.min(...shown.map((b) => priceCents(b, today))) : null;
  const priceLine = [
    lowest !== null ? fill(priceMessages.from, { price: formatMoney(lowest) }) : null,
    deposit ? fill(depositText(priceMessages.deposit, deposit), { notice }) : null,
    travel ? fill(priceMessages.travel, { miles: String(travel.freeMiles) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { shown, withQuery, ctaHref, onCta, priceLine, notice, available };
}
