import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatAddress, PAYMENT_NOTE, pricingRows, type BookingDetails } from "@/lib/booking/templates";
import { changePolicyText } from "@/lib/booking/reschedule-policy";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { backdropList, backdropSwatches } from "./components/backdrops";
import { ChalkBox, ChalkButton, ChalkList, Details, Heading, Paragraph, PhotographersIntro, Swatches } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  rescheduleNoticeHours?: number;
  /** "Adrian & Alondra" photo from /admin (absolute URL), if uploaded. */
  photographersPhoto?: string | null;
  images?: ImageMode;
  locale?: EmailLocale;
}

/** "What happens next", with the bundle's photo count ("choose your 20 favorites"). */
const nextSteps = (d: BookingDetails, locale: EmailLocale) => emailMessages(locale).confirmation.next.map((i) => fill(i, { count: d.bundle.photos?.trim() ?? "" }).replace(/\s+/g, " "));

function content(d: BookingDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  const date = formatLongDate(d.date);
  return {
    m,
    date,
    first: d.contact.parentName.split(" ")[0],
    time: fill(m.common.timeRange, { start: formatTimeLabel(d.start), end: formatTimeLabel(d.end) }),
    paymentRows: [
      [m.common.packageTotal, formatMoney(d.pricing.finalCents)],
      [m.common.paymentDue, m.common.paymentDueValue],
    ] as [string, string][],
  };
}

/** Customer booking confirmation (follows the active website theme). */
export function BookingConfirmation({
  details: d,
  theme: t,
  images,
  locale,
  cancelUrl,
  rescheduleUrl,
  rescheduleNoticeHours,
  photographersPhoto,
}: Omit<Options, "themeId" | "images"> & { details: BookingDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale }) {
  const { m, date, first, time, paymentRows } = content(d, locale);
  const c = m.confirmation;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(c.preheader, { date })}>
      <Heading theme={t} eyebrow={c.eyebrow} title={fill(c.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {fill(c.intro, { baby: d.contact.babyName || c.babyFallback })}
      </Paragraph>
      <Details
        theme={t}
        rows={[
          [m.common.reference, d.reference],
          [m.common.bundle, d.bundle.name],
          [m.common.date, date],
          [m.common.time, time],
          [m.common.location, formatAddress(d.address)],
          ...pricingRows(d.pricing),
        ]}
      />
      <ChalkBox theme={t} title={m.common.payment} rows={paymentRows} note={PAYMENT_NOTE.email} />
      <Swatches theme={t} title={m.backdrops.title} text={m.backdrops.text} swatches={backdropSwatches(locale)} />
      <ChalkList theme={t} title={m.prepGuide.title} items={m.prepGuide.items} />
      <ChalkList theme={t} title={c.nextTitle} items={nextSteps(d, locale)} color={t.chalk} mark="•" />
      <PhotographersIntro theme={t} title={c.meetTitle} text={c.meet} footnote={c.spanish} photo={photographersPhoto ? { src: photographersPhoto, alt: c.meetPhotoAlt } : null} />
      <Paragraph theme={t}>{`${c.babyLed} ${c.promise}`}</Paragraph>
      <Paragraph theme={t}>{c.changes}</Paragraph>
      {rescheduleUrl && rescheduleNoticeHours !== undefined && (
        <Paragraph theme={t} align="center">
          {changePolicyText(rescheduleNoticeHours)}
        </Paragraph>
      )}
      {rescheduleUrl && <ChalkButton theme={t} label={c.reschedule} href={rescheduleUrl} variant="outline" />}
      {cancelUrl && <ChalkButton theme={t} label={c.cancel} href={cancelUrl} variant="outline" caption={c.cancelCaption} />}
    </ChalkLayout>
  );
}

export async function bookingConfirmationEmail(d: BookingDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { m, date, first, time } = content(d, locale);
  const c = m.confirmation;
  const html = await renderHtml(
    <BookingConfirmation
      details={d}
      theme={theme}
      images={images}
      locale={locale}
      cancelUrl={opts.cancelUrl}
      rescheduleUrl={opts.rescheduleUrl}
      rescheduleNoticeHours={opts.rescheduleNoticeHours}
      photographersPhoto={opts.photographersPhoto}
    />,
  );
  const text = textLines([
    fill(c.title, { name: first }),
    "",
    `${m.common.reference}: ${d.reference}`,
    `${m.common.bundle}: ${d.bundle.name}`,
    `${m.common.date}: ${date}`,
    `${m.common.time}: ${time}`,
    `${m.common.location}: ${formatAddress(d.address)}`,
    ...pricingRows(d.pricing).map(([k, v]) => `${k}: ${v}`),
    `${m.common.paymentDue}: ${m.common.paymentDueValue}`,
    "",
    PAYMENT_NOTE.email,
    "",
    fill(m.backdrops.textLine, { list: backdropList(locale) }),
    "",
    `${m.prepGuide.title}:`,
    ...m.prepGuide.items.map((i) => `- ${i}`),
    "",
    `${c.nextTitle}:`,
    ...nextSteps(d, locale).map((i) => `- ${i}`),
    "",
    `${c.meetTitle}: ${c.meet} ${c.spanish}`,
    "",
    `${c.babyLed} ${c.promise}`,
    c.changes,
    opts.rescheduleUrl && opts.rescheduleNoticeHours !== undefined && `\n${changePolicyText(opts.rescheduleNoticeHours)}`,
    opts.rescheduleUrl && fill(c.rescheduleText, { url: opts.rescheduleUrl }),
    opts.cancelUrl && fill(c.cancelText, { url: opts.cancelUrl }),
    "",
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  const subject = fill(c.subject, { reference: d.reference, date, time: formatTimeLabel(d.start) });
  return { subject, html, text, attachments: images.attachments };
}
