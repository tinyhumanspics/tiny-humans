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

export interface OwnerBookedDetails {
  parentName: string;
  bundleName: string;
  /** "YYYY-MM-DD" (Miami) */
  date: string;
  /** "HH:MM" Miami time */
  start: string;
  /** When the held time is released if the deposit isn't paid: "YYYY-MM-DD" + "HH:MM" (Miami). */
  untilDate: string;
  untilTime: string;
  amountCents: number;
}

interface Options {
  themeId: string;
  /** The family's signed link: pick backdrops, then pay the deposit. */
  url: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

const lines = (d: OwnerBookedDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).deposit.booked;
  const deposit = formatMoney(d.amountCents);
  const date = formatLongDate(d.date, locale);
  const time = formatTimeLabel(d.start, locale);
  const until = `${formatLongDate(d.untilDate, locale)}, ${formatTimeLabel(d.untilTime, locale)}`;
  return {
    x,
    preheader: fill(x.preheader, { deposit, date, time }),
    title: fill(x.title, { name: d.parentName.split(" ")[0] }),
    intro: fill(x.intro, { bundle: d.bundleName, date, time, deposit }),
    hold: fill(x.hold, { until }),
    help: fill(x.help, { phone: site.contact.phone }),
  };
};

/**
 * Sent when the owner books a session for a family (/admin → Quotes / Booking, owner Nov 12): their date is saved and
 * held; the button opens their link to pick backdrops and pay the deposit, which confirms it.
 */
export function OwnerBooked({ details: d, theme: t, images, locale, url }: { details: OwnerBookedDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; url: string }) {
  const { x, preheader, title, intro, hold, help } = lines(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <ChalkButton theme={t} label={x.button} href={url} variant="solid" />
      <Paragraph theme={t} align="center">
        {hold}
      </Paragraph>
      <Paragraph theme={t} align="center" muted>
        {help}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function ownerBookedEmail(d: OwnerBookedDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { x, title, intro, hold, help } = lines(d, locale);
  const html = await renderHtml(<OwnerBooked details={d} theme={theme} images={images} locale={locale} url={opts.url} />);
  const text = textLines([title, "", intro, fill(x.buttonText, { url: opts.url }), "", hold, "", help, fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}

/** The same message as a text the owner can copy (Leads / Quotes): first name, date, time, deposit, link. */
export function ownerBookedSms(d: OwnerBookedDetails, url: string, locale: EmailLocale): string {
  const x = emailMessages(locale).deposit.booked;
  return fill(x.smsBody, { name: d.parentName.split(" ")[0], date: formatLongDate(d.date, locale), time: formatTimeLabel(d.start, locale), deposit: formatMoney(d.amountCents), url });
}
