import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import type { ExtrasLeft, ExtrasSettings } from "@/lib/photo-extras/types";
import { ChalkBox, ChalkButton, ChalkGroups, ChalkList, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  /** The Pixieset gallery where the family picks their favorites. */
  galleryUrl: string;
  /** How many favorites they choose (the bundle's edited photos, e.g. "20"). */
  favorites: string;
  /** Exact amount still due (cents). 0 = nothing to pay. */
  amountCents: number;
  /** Already paid (e.g. with the payment link before the session): no payment request. */
  paid: boolean;
  /** The booking's payment link (never expires). */
  payUrl?: string;
  /** "Want more photos?" (owner, Nov 20): the extras page and what's still on offer; none = extras off or all bought. */
  extras?: { url: string; left: ExtrasLeft; prices: Pick<ExtrasSettings, "extraPhotoCents" | "fullGalleryCents" | "rawFilesCents"> };
  images?: ImageMode;
  locale?: EmailLocale;
}

/** The extras offered, one line each (only what's still left to buy). */
function extrasItems(locale: EmailLocale, e: NonNullable<Options["extras"]>): string[] {
  const x = emailMessages(locale).afterSession;
  return [
    e.left.extrasLeft > 0 && fill(x.extrasExtra, { price: formatMoney(e.prices.extraPhotoCents), max: String(e.left.extrasLeft) }),
    e.left.canFull && fill(x.extrasFull, { price: formatMoney(e.prices.fullGalleryCents - e.left.fullCreditCents) }),
    e.left.canRaw && fill(x.extrasRaw, { price: formatMoney(e.prices.rawFilesCents) }),
  ].filter((i): i is string => Boolean(i));
}

/**
 * "Send sneak peek" (from /admin after the session): thank-you, the Pixieset gallery to choose their favorites, more
 * photos to add (when extras are on), and the payment button only while the session is unpaid.
 */
export function SneakPeek({ details: d, theme: t, images, locale, galleryUrl, favorites, amountCents, paid, payUrl, extras }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
  const m = emailMessages(locale);
  const x = m.afterSession;
  const first = d.parentName.split(" ")[0];
  const amount = formatMoney(amountCents);
  const v = { count: favorites, bundle: d.bundleName };
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(x.preheader, v)}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {fill(x.intro, { baby: d.babyName || m.confirmation.babyFallback })}
      </Paragraph>
      <ChalkButton theme={t} label={x.galleryButton} href={galleryUrl} variant="solid" />
      <ChalkList theme={t} title={fill(x.pickTitle, v)} items={x.pick.map((i) => fill(i, v))} />
      {extras && (
        <>
          <ChalkGroups theme={t} title={x.extrasTitle} intro={fill(x.extrasIntro, v)} groups={[{ items: extrasItems(locale, extras), mark: "+" }]} />
          <ChalkButton theme={t} label={x.extrasButton} href={extras.url} variant="outline" />
          <Paragraph theme={t} align="center" muted>
            {x.extrasHeart}
          </Paragraph>
        </>
      )}
      {amountCents <= 0 ? (
        <Paragraph theme={t} align="center">
          {x.nothingDue}
        </Paragraph>
      ) : paid || !payUrl ? (
        <Paragraph theme={t} align="center">
          {x.paid}
        </Paragraph>
      ) : (
        <>
          <ChalkBox
            theme={t}
            title={x.payTitle}
            rows={[
              [m.common.bundle, d.bundleName],
              [x.amountDue, amount],
            ]}
            note={x.payNote}
          />
          <ChalkButton theme={t} label={fill(x.payButton, { amount })} href={payUrl} variant="outline" />
        </>
      )}
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function sneakPeekEmail(d: AfterSessionDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.afterSession;
  const first = d.parentName.split(" ")[0];
  const amount = formatMoney(opts.amountCents);
  const v = { count: opts.favorites, bundle: d.bundleName };
  const html = await renderHtml(<SneakPeek details={d} theme={theme} images={images} locale={locale} galleryUrl={opts.galleryUrl} favorites={opts.favorites} amountCents={opts.amountCents} paid={opts.paid} payUrl={opts.payUrl} extras={opts.extras} />);
  const owes = opts.amountCents > 0 && !opts.paid && opts.payUrl;
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    fill(x.intro, { baby: d.babyName || m.confirmation.babyFallback }),
    fill(x.galleryText, { url: opts.galleryUrl }),
    "",
    `${fill(x.pickTitle, v)}:`,
    ...x.pick.map((i) => `- ${fill(i, v)}`),
    "",
    ...(opts.extras ? [`${x.extrasTitle}`, fill(x.extrasIntro, v), ...extrasItems(locale, opts.extras).map((i) => `- ${i}`), fill(x.extrasText, { url: opts.extras.url }), x.extrasHeart, ""] : []),
    opts.amountCents <= 0 ? x.nothingDue : owes ? `${x.amountDue}: ${amount} (${d.bundleName})` : x.paid,
    owes && fill(x.payText, { amount, url: opts.payUrl! }),
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { name: first, count: opts.favorites }), html, text, attachments: images.attachments };
}
