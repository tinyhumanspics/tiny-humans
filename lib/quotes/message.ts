import type en from "@/messages/en.json";
import { formatMoney, type CodeTerms, type PriceQuote } from "@/lib/pricing/engine";
import { EXTRA_BABY_KIND } from "@/lib/booking/extra-babies";
import type { TravelQuote } from "@/lib/travel/types";
import type { QuoteLine } from "./types";

type Copy = typeof en.quoteMessage;

/** The owner's "% off" on a quote, priced like a percentage discount code (so it never stacks with a special offer). */
export const quotePercentTerms = (percent: number): CodeTerms | null => (percent > 0 ? { code: `${percent}%`, type: "percent", value: percent } : null);

/** Which saving a quoted bundle price uses, and its label ("Thanksgiving offer" / "10% off"). */
export function quoteSaving(q: PriceQuote, percent: number, percentLabel: string): { saving: "offer" | "percent" | null; label: string | null } {
  if (q.pricingType === "discount") return { saving: "percent", label: percentLabel.replace("{percent}", String(percent)) };
  if (q.pricingType === "offer") return { saving: "offer", label: q.offerLabel };
  return { saving: null, label: null };
}
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * The quote as a message the owner pastes into a DM or text: one line per bookable bundle (total, then what it's
 * made of), the offer line the Bundles page shows, the travel and deposit notes, and the bundles link. Pure.
 */
export function quoteMessage(input: { zip: string; lines: QuoteLine[]; travel: TravelQuote; offerLine: string | null; deposit: { cents: number; varies: boolean } | null; link: string }, copy: Copy): string {
  const lines = input.lines
    .filter((l) => !l.unavailable)
    .map((l) => {
      const offer = l.bundleCents < l.regularCents && l.offerLabel;
      const extras = l.addons.map((a) =>
        a.kind === EXTRA_BABY_KIND
          ? fill(a.quantity === 1 ? copy.twins : copy.triplets, { price: formatMoney(a.totalCents) })
          : fill(a.quantity === 1 ? copy.extraPerson : copy.extraPeople, { price: formatMoney(a.totalCents), count: String(a.quantity) }),
      );
      const travel = l.travelCents > 0 ? [fill(copy.travel, { price: formatMoney(l.travelCents) })] : [];
      const total = formatMoney(l.totalCents);
      if (!extras.length && !travel.length) {
        return offer ? fill(copy.lineParts, { bundle: l.name, total, parts: fill(copy.offerOnly, { offer, regular: formatMoney(l.regularCents) }) }) : fill(copy.line, { bundle: l.name, total });
      }
      // "Thanksgiving offer $134.10", but "$134.10 with 10% off" (never "10% off $134.10", which reads as 10% off of it)
      const first = offer ? fill(l.saving === "percent" ? copy.withPercent : copy.offer, { offer, price: formatMoney(l.bundleCents) }) : formatMoney(l.bundleCents);
      return fill(copy.lineParts, { bundle: l.name, total, parts: [first, ...extras, ...travel].join(" + ") });
    });
  const notes = [
    input.offerLine,
    input.travel.status === "free" ? copy.noTravel : null,
    input.deposit ? fill(input.deposit.varies ? copy.depositFrom : copy.deposit, { deposit: formatMoney(input.deposit.cents) }) : copy.noDeposit,
    fill(copy.book, { link: input.link }),
  ].filter((n): n is string => Boolean(n));
  return [fill(copy.intro, { zip: input.zip }), "", ...lines, "", ...notes].join("\n");
}
