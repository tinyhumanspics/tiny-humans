import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import type { RescheduleDetails } from "@/lib/booking/templates";
import { paymentDue } from "@/lib/email/payment";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkBox, ChalkButton, Details, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

type Manage = { reschedule: string; cancel: string };

function content(r: RescheduleDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  const range = (start: string, end: string) => fill(m.common.timeRange, { start: formatTimeLabel(start), end: formatTimeLabel(end) });
  return {
    m,
    first: r.parentName.split(" ")[0],
    oldDate: formatLongDate(r.oldDate),
    newDate: formatLongDate(r.newDate),
    oldTime: range(r.oldStart, r.oldEnd),
    newTime: range(r.newStart, r.newEnd),
    total: formatMoney(r.packageTotalCents),
    due: paymentDue(locale, r.totalCents ?? r.packageTotalCents, r.deposit),
  };
}

/** Customer reschedule confirmation (active website theme, new manage links). */
export function BookingRescheduled({ details: r, theme: t, images, locale, manage }: { details: RescheduleDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; manage?: Manage }) {
  const { m, first, oldDate, newDate, oldTime, newTime, total, due } = content(r, locale);
  const x = m.rescheduled;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(x.preheader, { date: newDate, time: formatTimeLabel(r.newStart) })}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {x.message}
      </Paragraph>
      <Details
        theme={t}
        rows={[
          [m.common.reference, r.reference],
          [m.common.bundle, r.bundleName],
          [x.previous, `${oldDate}\n${oldTime}`],
          [x.newDate, newDate],
          [x.newTime, newTime],
          [m.common.location, r.location],
          [m.common.packageTotal, total],
        ]}
      />
      <ChalkBox
        theme={t}
        title={m.common.payment}
        rows={[[m.common.packageTotal, total], ...due.rows]}
        note={due.note}
      />
      {manage && <ChalkButton theme={t} label={x.reschedule} href={manage.reschedule} variant="outline" />}
      {manage && <ChalkButton theme={t} label={x.cancel} href={manage.cancel} variant="outline" caption={x.linksCaption} />}
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function bookingRescheduledEmail(r: RescheduleDetails, opts: { themeId: string; manage?: Manage; images?: ImageMode; locale?: EmailLocale }): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { m, first, oldDate, newDate, oldTime, newTime, total, due } = content(r, locale);
  const x = m.rescheduled;
  const html = await renderHtml(<BookingRescheduled details={r} theme={theme} images={images} locale={locale} manage={opts.manage} />);
  const text = textLines([
    fill(m.common.greeting, { name: first }),
    "",
    x.message,
    "",
    `${m.common.reference}: ${r.reference}`,
    `${m.common.bundle}: ${r.bundleName}`,
    `${x.previous}: ${oldDate}, ${oldTime}`,
    `${x.newText}: ${newDate}, ${newTime}`,
    `${m.common.location}: ${r.location}`,
    `${m.common.packageTotal}: ${total}`,
    ...due.rows.map(([k, v]) => `${k}: ${v}`),
    "",
    opts.manage && fill(x.rescheduleText, { url: opts.manage.reschedule }),
    opts.manage && fill(x.cancelText, { url: opts.manage.cancel }),
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { reference: r.reference }), html, text, attachments: images.attachments };
}
