import { formatMoney } from "@/lib/pricing/engine";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import type { EmailTheme } from "@/lib/email/theme";
import { deliveryText } from "@/lib/photo-extras/format";
import type { Deliveries, ExtrasLeft, ExtrasSettings } from "@/lib/photo-extras/types";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { ChalkButton, ChalkGroups, Paragraph } from "./blocks";

/** "Want more photos?" in the sneak-peek and gallery emails (owner, Nov 20): the extras page and what's still on offer. */
export interface EmailExtras {
  url: string;
  left: ExtrasLeft;
  prices: Pick<ExtrasSettings, "extraPhotoCents" | "fullGalleryCents" | "rawFilesCents">;
  /** When each option arrives if bought now (extra photos come with the finished gallery until it's delivered). */
  delivery: Deliveries;
}

/** One line per option still left, with its price and when it arrives. */
function items(locale: EmailLocale, e: EmailExtras): string[] {
  const x = emailMessages(locale).afterSession;
  const when = (key: keyof Deliveries) => deliveryText(e.delivery[key], (locale === "es" ? es : en).extras);
  return [
    e.left.extrasLeft > 0 && fill(x.extrasExtra, { price: formatMoney(e.prices.extraPhotoCents), max: String(e.left.extrasLeft), when: when("extras") }),
    e.left.canFull && fill(x.extrasFull, { price: formatMoney(e.prices.fullGalleryCents - e.left.fullCreditCents), when: when("full") }),
    e.left.canRaw && fill(x.extrasRaw, { price: formatMoney(e.prices.rawFilesCents), when: when("raw") }),
  ].filter((i): i is string => Boolean(i));
}

/** Before the finished gallery: "Love more than 20? … before we start editing"; after it: "You can still add them". */
const intro = (locale: EmailLocale, e: EmailExtras, count: string) => {
  const x = emailMessages(locale).afterSession;
  return e.delivery.extras.withGallery ? fill(x.extrasIntro, { count }) : x.extrasIntroAfter;
};

export function ExtrasOffer({ theme: t, locale, extras, count }: { theme: EmailTheme; locale: EmailLocale; extras: EmailExtras; count: string }) {
  const x = emailMessages(locale).afterSession;
  return (
    <>
      <ChalkGroups theme={t} title={x.extrasTitle} intro={intro(locale, extras, count)} groups={[{ items: items(locale, extras), mark: "+" }]} />
      <ChalkButton theme={t} label={x.extrasButton} href={extras.url} variant="outline" />
      <Paragraph theme={t} align="center" muted>
        {x.extrasHeart}
      </Paragraph>
    </>
  );
}

/** The same, for the plain-text version. */
export function extrasOfferText(locale: EmailLocale, extras: EmailExtras, count: string): string[] {
  const x = emailMessages(locale).afterSession;
  return [x.extrasTitle, intro(locale, extras, count), ...items(locale, extras).map((i) => `- ${i}`), fill(x.extrasText, { url: extras.url }), x.extrasHeart, ""];
}
