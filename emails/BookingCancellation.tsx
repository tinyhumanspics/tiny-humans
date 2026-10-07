import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import type { CancellationDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkButton, Details, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

const bookUrl = () => `${site.url.replace(/\/$/, "")}/book`;

function content(c: CancellationDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  return {
    m,
    first: c.parentName.split(" ")[0],
    date: formatLongDate(c.date),
    time: fill(m.common.timeRange, { start: formatTimeLabel(c.start), end: formatTimeLabel(c.end) }),
  };
}

/** Customer cancellation confirmation (follows the active website theme). */
export function BookingCancellation({ details: c, theme: t, images, locale }: { details: CancellationDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale }) {
  const { m, first, date, time } = content(c, locale);
  const x = m.cancellation;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(x.preheader, { reference: c.reference })}>
      <Heading theme={t} eyebrow={x.eyebrow} title={x.title} />
      <Paragraph theme={t} align="center">
        {fill(m.common.greeting, { name: first })}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {x.message}
      </Paragraph>
      <Details
        theme={t}
        rows={[
          [x.name, c.parentName],
          [m.common.reference, c.reference],
          [m.common.bundle, c.bundleName],
          [x.originalDate, date],
          [x.originalTime, time],
          [x.reason, c.reason],
        ]}
      />
      <ChalkButton theme={t} label={x.bookAgain} href={bookUrl()} variant="solid" />
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function bookingCancellationEmail(c: CancellationDetails, opts: { themeId: string; images?: ImageMode; locale?: EmailLocale }): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { m, first, date, time } = content(c, locale);
  const x = m.cancellation;
  const html = await renderHtml(<BookingCancellation details={c} theme={theme} images={images} locale={locale} />);
  const text = textLines([
    fill(m.common.greeting, { name: first }),
    "",
    x.message,
    "",
    `${m.common.reference}: ${c.reference}`,
    `${m.common.bundle}: ${c.bundleName}`,
    `${x.originalDate}: ${date}`,
    `${x.originalTime}: ${time}`,
    `${x.reason}: ${c.reason}`,
    "",
    fill(x.bookAgainText, { url: bookUrl() }),
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { reference: c.reference }), html, text, attachments: images.attachments };
}
