import type { Bundle } from "./types";
import { activeOffer } from "./engine";

/**
 * The line under the Bundles heading (/bundles and the ad landing page) while special offers run (owner, Nov 10):
 * written from the offers themselves, so it follows the percent, label and last day the owner saves in /admin →
 * Pricing, and disappears with the offers. Nothing to type.
 */
export interface PromoSummary {
  /** The label every offer shares, or null when they differ. */
  label: string | null;
  /** The whole percent every offer shares, or null (price offers, or different percents). */
  percent: number | null;
  /** The last day every offer shares, or null when they differ. */
  endsOn: string | null;
  /** The bundles on offer, or null when it's every bundle. */
  names: string[] | null;
}

const shared = <T,>(values: T[]): T | null => (values.every((value) => value === values[0]) ? values[0] : null);

export function promoSummary(bundles: Bundle[], today: string): PromoSummary | null {
  const live = bundles.filter((b) => b.active !== false);
  const offers = live.flatMap((b) => {
    const offer = activeOffer(b, today);
    return offer ? [{ name: b.name, ...offer }] : [];
  });
  if (!offers.length) return null;
  return {
    label: shared(offers.map((o) => o.label)),
    percent: shared(offers.map((o) => o.percent)),
    endsOn: shared(offers.map((o) => o.endsOn)),
    names: offers.length === live.length ? null : offers.map((o) => o.name),
  };
}

export interface PromoCopy {
  every: string;
  everyPercent: string;
  some: string;
  somePercent: string;
  endsOn: string;
  specialOffer: string;
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/** "Thanksgiving offer: 10% off every bundle. Book by November 30, 2026." */
export function promoLine(s: PromoSummary, copy: PromoCopy, list: (names: string[]) => string, date: (key: string) => string): string {
  const template = s.names ? (s.percent ? copy.somePercent : copy.some) : s.percent ? copy.everyPercent : copy.every;
  const main = fill(template, { label: s.label ?? copy.specialOffer, percent: String(s.percent ?? ""), bundles: s.names ? list(s.names) : "" });
  return s.endsOn ? `${main} ${fill(copy.endsOn, { date: date(s.endsOn) })}` : main;
}
