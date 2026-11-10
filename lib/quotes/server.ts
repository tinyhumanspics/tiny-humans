import "server-only";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { bookingRules, bundlesHref } from "@/config/booking";
import { site } from "@/config/site";
import { getSpanishPublication } from "@/i18n/publication";
import { asksFamily } from "@/lib/booking/family";
import { extraBabyLine, familyLimit, withAddons } from "@/lib/booking/extra-babies";
import { formatLongDate } from "@/lib/booking/dates";
import { todayInZone } from "@/lib/booking/timezone";
import { getDepositSettings } from "@/lib/deposit/server";
import { depositCentsFor } from "@/lib/deposit/types";
import { computeQuote } from "@/lib/pricing/engine";
import { promoLine, promoSummary } from "@/lib/pricing/promo";
import { getAdminCatalog } from "@/lib/pricing/server";
import type { AdminBundle, Bundle } from "@/lib/pricing/types";
import { travelQuote } from "@/lib/travel/distance";
import { getTravelSettings } from "@/lib/travel/server";
import { quoteMessage, quotePercentTerms, quoteSaving } from "./message";
import type { QuoteLine, QuoteResult } from "./types";

/** The same bundle in Spanish (owner-saved copy), for the Spanish message. */
const inSpanish = (b: AdminBundle): Bundle => ({
  ...b,
  name: b.spanish?.name || b.name,
  offer: b.offer ? { ...b.offer, label: b.offer.label ? b.spanish?.offerLabel || b.offer.label : es.bundlesPage.promo.specialOffer } : b.offer,
});

/**
 * /admin → Quotes: every active bundle's price for a family's ZIP code today, with the same functions the booking
 * form uses (special offer, twins/triplets, extra family members, travel fee, deposit). Only the ZIP code and the
 * counts come in: the family's address never leaves the owner's screen.
 */
export async function buildQuote(zip: string, babies: number, family: number, percent = 0): Promise<QuoteResult> {
  const [catalog, travelSettings, deposits, spanish] = await Promise.all([
    getAdminCatalog(),
    getTravelSettings(),
    getDepositSettings(),
    getSpanishPublication().catch(() => ({ published: false })),
  ]);
  const today = todayInZone(bookingRules.timeZone);
  const travel = travelQuote(zip, travelSettings);
  const travelCents = travel.status === "fee" ? travel.feeCents : 0;
  const active = catalog.filter((b) => b.active !== false);

  const lineFor = (b: Bundle, percentLabel: string): QuoteLine => {
    const people = asksFamily(b) ? family : 0;
    const limit = familyLimit(b, babies);
    const unavailable =
      babies > 1 && !extraBabyLine(b, babies)
        ? `No ${babies === 2 ? "twins" : "triplets"} option on this bundle.`
        : people > limit
          ? `Takes up to ${limit} family members besides the ${babies === 1 ? "baby" : "babies"}.`
          : null;
    // the owner's % off counts like a discount code: the bigger of it and a running special offer, never both
    const quote = withAddons(computeQuote(b, today, quotePercentTerms(percent)), b, unavailable ? 1 : babies, unavailable ? 0 : people);
    const { saving, label } = quoteSaving(quote, percent, percentLabel);
    const totalCents = quote.totalCents + travelCents;
    return {
      bundleId: b.id,
      name: b.name,
      bundleCents: quote.finalCents,
      regularCents: quote.regularCents,
      offerLabel: label,
      saving,
      addons: quote.addons,
      travelCents,
      totalCents,
      depositCents: deposits?.enabled ? depositCentsFor(totalCents, b.id, deposits) : null,
      unavailable,
    };
  };

  const lines = active.map((b) => lineFor(b, en.quoteMessage.percentOff));
  const linesEs = active.map((b) => lineFor(inSpanish(b), es.quoteMessage.percentOff)).map((l, i) => ({ ...l, unavailable: lines[i].unavailable }));
  // the website's offer line only when a quoted price actually uses that offer
  const usesOffer = lines.some((l) => !l.unavailable && l.saving === "offer");
  const bookable = lines.filter((l) => !l.unavailable && l.depositCents !== null).map((l) => l.depositCents!);
  const deposit = bookable.length ? { cents: Math.min(...bookable), varies: new Set(bookable).size > 1 } : null;
  const offerLine = (bundles: Bundle[], locale: "en" | "es") => {
    if (!usesOffer) return null;
    const summary = promoSummary(bundles, today);
    const copy = (locale === "es" ? es : en).bundlesPage.promo;
    const list = (names: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
    return summary ? promoLine(summary, copy, list, (key) => formatLongDate(key, locale).replace(/^[^,]+, /, "")) : null;
  };
  const link = (locale: "en" | "es") => `${site.url}${bundlesHref(null, locale)}`;

  return {
    zip,
    babies,
    family,
    percent,
    baseZip: travelSettings?.baseZip ?? null,
    travel,
    today,
    lines,
    messages: {
      en: quoteMessage({ zip, lines, travel, offerLine: offerLine(active, "en"), deposit, link: link("en") }, en.quoteMessage),
      es: quoteMessage({ zip, lines: linesEs, travel, offerLine: offerLine(active.map(inSpanish), "es"), deposit, link: link(spanish.published ? "es" : "en") }, es.quoteMessage),
    },
  };
}
