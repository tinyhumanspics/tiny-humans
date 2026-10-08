import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

export interface AbandonedDetails {
  parentName: string;
  bundleName: string;
  date: string;
  /** "HH:MM" Miami time */
  start: string;
}

interface Options {
  themeId: string;
  /** The bundle's booking calendar. */
  bookUrl: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

const lines = (d: AbandonedDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).deposit.abandoned;
  return { x, title: fill(x.title, { name: d.parentName.split(" ")[0] }), intro: fill(x.intro, { bundle: d.bundleName, date: formatLongDate(d.date), time: formatTimeLabel(d.start) }) };
};

/** One email when a family left the deposit page unpaid and the time was released. */
export function DepositAbandoned({ details: d, theme: t, images, locale, bookUrl }: { details: AbandonedDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; bookUrl: string }) {
  const { x, title, intro } = lines(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {x.again}
      </Paragraph>
      <ChalkButton theme={t} label={x.button} href={bookUrl} variant="solid" />
      <Paragraph theme={t} align="center" muted>
        {x.help}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function depositAbandonedEmail(d: AbandonedDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { x, title, intro } = lines(d, locale);
  const html = await renderHtml(<DepositAbandoned details={d} theme={theme} images={images} locale={locale} bookUrl={opts.bookUrl} />);
  const text = textLines([title, "", intro, "", x.again, fill(x.buttonText, { url: opts.bookUrl }), "", x.help, fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
