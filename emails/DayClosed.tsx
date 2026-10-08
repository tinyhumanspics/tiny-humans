import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkButton, Details, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

export interface DayClosedDetails {
  reference: string;
  parentName: string;
  bundleName: string;
  date: string;
  /** Miami local time, HH:MM. */
  start: string;
  end: string;
  /** Optional owner-written context, shared with every affected family. */
  note?: string;
  /** The booking had not been confirmed because its deposit page was still open. */
  pending: boolean;
}

interface Options {
  themeId: string;
  actionUrl: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

function content(d: DayClosedDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  const x = m.dayClosed;
  const date = formatLongDate(d.date, locale);
  const time = fill(m.common.timeRange, { start: formatTimeLabel(d.start, locale), end: formatTimeLabel(d.end, locale) });
  return {
    m,
    x,
    date,
    time,
    first: d.parentName.split(" ")[0],
    message: fill(x.message, { date, time: formatTimeLabel(d.start, locale) }),
    help: fill(x.help, { phone: site.contact.phone }),
  };
}

/** A single emergency schedule-change email after /admin closes a day. */
export function DayClosed({ details: d, theme: t, images, locale, actionUrl }: { details: DayClosedDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; actionUrl: string }) {
  const { m, x, date, time, first, message, help } = content(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(x.preheader, { date })}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">{message}</Paragraph>
      <Details
        theme={t}
        rows={[
          [m.common.reference, d.reference],
          [m.common.bundle, d.bundleName],
          [x.originalDate, date],
          [x.originalTime, time],
        ]}
      />
      {d.note && (
        <Paragraph theme={t} align="center">
          {`${x.noteTitle}: ${d.note}`}
        </Paragraph>
      )}
      <Paragraph theme={t} align="center">{d.pending ? x.pendingNext : x.activeNext}</Paragraph>
      <ChalkButton theme={t} label={d.pending ? x.book : x.reschedule} href={actionUrl} variant="solid" />
      <Paragraph theme={t} align="center" muted>{help}</Paragraph>
    </ChalkLayout>
  );
}

export async function dayClosedEmail(d: DayClosedDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { m, x, date, time, first, message, help } = content(d, locale);
  const html = await renderHtml(<DayClosed details={d} theme={theme} images={images} locale={locale} actionUrl={opts.actionUrl} />);
  const text = textLines([
    fill(m.common.greeting, { name: first }),
    "",
    message,
    "",
    `${m.common.reference}: ${d.reference}`,
    `${m.common.bundle}: ${d.bundleName}`,
    `${x.originalDate}: ${date}`,
    `${x.originalTime}: ${time}`,
    d.note && `${x.noteTitle}: ${d.note}`,
    "",
    d.pending ? x.pendingNext : x.activeNext,
    fill(d.pending ? x.bookText : x.rescheduleText, { url: opts.actionUrl }),
    "",
    help,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { reference: d.reference }), html, text, attachments: images.attachments };
}
