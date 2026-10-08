import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { formatAddress, pricingRows, totalDueCents, type BookingDetails } from "@/lib/booking/templates";
import { paymentDue, prepGuideItems } from "@/lib/email/payment";
import { changePolicyText } from "@/lib/booking/reschedule-policy";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { backdropSwatches, type EmailSwatch } from "./components/backdrops";
import { BackdropChoice, backdropTextLine } from "./components/BackdropChoice";
import { ChalkBox, ChalkButton, ChalkList, Details, Heading, Paragraph, PhotographersIntro } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  rescheduleNoticeHours?: number;
  /** "Adrian & Alondra" photo from /admin (absolute URL), if uploaded. */
  photographersPhoto?: string | null;
  /** The backdrop page (pick or change their backdrop). */
  backdropUrl?: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

/** "What happens next", with the bundle's photo count ("choose your 20 favorites"); its last line is about paying. */
const nextSteps = (d: BookingDetails, locale: EmailLocale) => {
  const m = emailMessages(locale);
  const items = d.deposit?.status === "paid" ? [...m.confirmation.next.slice(0, -1), m.deposit.nextLast] : m.confirmation.next;
  return items.map((i) => fill(i, { count: d.bundle.photos?.trim() ?? "" }).replace(/\s+/g, " "));
};

function content(d: BookingDetails, locale: EmailLocale) {
  const m = emailMessages(locale);
  const date = formatLongDate(d.date);
  const due = paymentDue(locale, totalDueCents(d.pricing, d.travel), d.deposit);
  return {
    m,
    date,
    first: d.contact.parentName.split(" ")[0],
    time: fill(m.common.timeRange, { start: formatTimeLabel(d.start), end: formatTimeLabel(d.end) }),
    paymentRows: [[m.common.packageTotal, formatMoney(d.pricing.finalCents)], ...travelRows(d, locale), ...due.rows] as [string, string][],
    due,
    prepGuide: prepGuideItems(locale, d.deposit?.status === "paid"),
    location: d.location ?? formatAddress(d.address),
  };
}

/** Travel fee + new total, only when there's a fee. */
function travelRows(d: BookingDetails, locale: EmailLocale): [string, string][] {
  const m = emailMessages(locale);
  const fee = d.travel?.feeCents ?? 0;
  if (fee <= 0) return [];
  return [
    [m.common.travelFee, d.travel?.miles === null || d.travel?.miles === undefined ? formatMoney(fee) : fill(m.common.travelFeeValue, { fee: formatMoney(fee), miles: String(d.travel.miles) })],
    [m.common.total, formatMoney(totalDueCents(d.pricing, d.travel))],
  ];
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
  backdropUrl,
  swatches,
}: Omit<Options, "themeId" | "images"> & { details: BookingDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; swatches: EmailSwatch[] }) {
  const { m, date, first, time, paymentRows, due, prepGuide, location } = content(d, locale);
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
          [m.common.location, location],
          ...pricingRows(d.pricing),
          ...travelRows(d, locale),
        ]}
      />
      <ChalkBox theme={t} title={m.common.payment} rows={paymentRows} note={due.note} />
      <BackdropChoice theme={t} locale={locale} picks={d.backdrops ?? []} swatches={swatches} url={backdropUrl} />
      <ChalkList theme={t} title={m.prepGuide.title} items={prepGuide} />
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
  const picks = d.backdrops ?? [];
  const backdrop = backdropSwatches(locale, opts.images ?? "cid", picks.length ? picks : undefined);
  const { m, date, first, time, due, prepGuide, location } = content(d, locale);
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
      backdropUrl={opts.backdropUrl}
      swatches={backdrop.swatches}
    />,
  );
  const text = textLines([
    fill(c.title, { name: first }),
    "",
    `${m.common.reference}: ${d.reference}`,
    `${m.common.bundle}: ${d.bundle.name}`,
    `${m.common.date}: ${date}`,
    `${m.common.time}: ${time}`,
    `${m.common.location}: ${location}`,
    ...pricingRows(d.pricing).map(([k, v]) => `${k}: ${v}`),
    ...travelRows(d, locale).map(([k, v]) => `${k}: ${v}`),
    ...due.rows.map(([k, v]) => `${k}: ${v}`),
    "",
    due.note,
    "",
    backdropTextLine(locale, picks, opts.backdropUrl),
    "",
    `${m.prepGuide.title}:`,
    ...prepGuide.map((i) => `- ${i}`),
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
  return { subject, html, text, attachments: [...images.attachments, ...backdrop.attachments] };
}
