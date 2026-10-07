import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkBox, ChalkButton, ChalkList, Heading, Paragraph } from "./components/blocks";
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
  images?: ImageMode;
  locale?: EmailLocale;
}

/**
 * "Send sneak peek" (from /admin after the session): thank-you, the Pixieset gallery to choose their favorites, and
 * the payment button only while the session is unpaid.
 */
export function SneakPeek({ details: d, theme: t, images, locale, galleryUrl, favorites, amountCents, paid, payUrl }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
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
  const html = await renderHtml(<SneakPeek details={d} theme={theme} images={images} locale={locale} galleryUrl={opts.galleryUrl} favorites={opts.favorites} amountCents={opts.amountCents} paid={opts.paid} payUrl={opts.payUrl} />);
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
    opts.amountCents <= 0 ? x.nothingDue : owes ? `${x.amountDue}: ${amount} (${d.bundleName})` : x.paid,
    owes && fill(x.payText, { amount, url: opts.payUrl! }),
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { name: first, count: opts.favorites }), html, text, attachments: images.attachments };
}
