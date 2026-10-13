import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { formatMoney } from "@/lib/pricing/engine";
import { ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

export interface DepositLinkDetails {
  parentName: string;
  bundleName: string;
  date: string;
  /** "HH:MM" Miami time */
  start: string;
  /** "HH:MM" Miami time: when the held time is released if the deposit isn't paid. */
  until: string;
  amountCents: number;
}

interface Options {
  themeId: string;
  /** The family's signed deposit page (it opens Stripe while the time is held). */
  payUrl: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

const lines = (d: DepositLinkDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).deposit.link;
  const deposit = formatMoney(d.amountCents);
  const date = formatLongDate(d.date, locale);
  const time = formatTimeLabel(d.start, locale);
  return {
    x,
    deposit,
    preheader: fill(x.preheader, { deposit, date, time }),
    title: fill(x.title, { name: d.parentName.split(" ")[0] }),
    intro: fill(x.intro, { bundle: d.bundleName, date, time, deposit }),
    hold: fill(x.hold, { until: formatTimeLabel(d.until, locale) }),
    button: fill(x.button, { deposit }),
  };
};

/** Sent from /admin ("Email payment link") when a family's deposit page didn't open or got lost: pay to confirm. */
export function DepositLink({ details: d, theme: t, images, locale, payUrl }: { details: DepositLinkDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; payUrl: string }) {
  const { x, preheader, title, intro, hold, button } = lines(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <ChalkButton theme={t} label={button} href={payUrl} variant="solid" />
      <Paragraph theme={t} align="center">
        {hold}
      </Paragraph>
      <Paragraph theme={t} align="center" muted>
        {x.help}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function depositLinkEmail(d: DepositLinkDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { x, title, intro, hold } = lines(d, locale);
  const html = await renderHtml(<DepositLink details={d} theme={theme} images={images} locale={locale} payUrl={opts.payUrl} />);
  const text = textLines([title, "", intro, fill(x.buttonText, { url: opts.payUrl }), "", hold, "", x.help, fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
