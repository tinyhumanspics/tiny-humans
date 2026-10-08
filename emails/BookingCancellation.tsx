import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
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

/** What happened to their deposit (refunded, on its way, or kept). */
function depositLine(c: CancellationDetails, locale: EmailLocale): string | null {
  const x = emailMessages(locale).deposit;
  const d = c.deposit;
  if (!d) return null;
  const deposit = formatMoney(d.amountCents);
  return fill(d.result === "refunded" ? x.cancelRefunded : d.result === "refund_failed" ? x.cancelRefundSoon : x.cancelKept, { deposit });
}

function content(c: CancellationDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  return {
    m,
    deposit: depositLine(c, locale),
    first: c.parentName.split(" ")[0],
    date: formatLongDate(c.date, locale),
    time: fill(m.common.timeRange, { start: formatTimeLabel(c.start, locale), end: formatTimeLabel(c.end, locale) }),
  };
}

/** Customer cancellation confirmation (follows the active website theme). */
export function BookingCancellation({ details: c, theme: t, images, locale }: { details: CancellationDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale }) {
  const { m, first, date, time, deposit } = content(c, locale);
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
      {deposit && (
        <Paragraph theme={t} align="center">
          {deposit}
        </Paragraph>
      )}
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
  const { m, first, date, time, deposit } = content(c, locale);
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
    deposit ? `\n${deposit}` : undefined,
    "",
    fill(x.bookAgainText, { url: bookUrl() }),
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { reference: c.reference }), html, text, attachments: images.attachments };
}
