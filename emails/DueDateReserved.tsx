import { site } from "@/config/site";
import { formatLongDate } from "@/lib/booking/dates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { formatMoney } from "@/lib/pricing/engine";
import { ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

export interface DueReservedDetails {
  reference: string;
  parentName: string;
  bundleName: string;
  dueDate: string;
  bundlePriceCents: number;
  regularPriceCents: number;
  offerLabel: string | null;
  /** 0 = no deposit paid (deposits off, or Stripe was down). */
  depositPaidCents: number;
  babyCount: number;
  /** The discount code they entered (owner, Nov 11): what it takes off the regular price. */
  code?: { code: string; offCents: number } | null;
}

interface Options {
  themeId: string;
  /** /book for their bundle with the schedule token (no new deposit, price kept). */
  scheduleUrl: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

// one string per text run (React would add <!-- --> between adjacent pieces)
const lines = (d: DueReservedDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).dueDate;
  const price = formatMoney(d.bundlePriceCents);
  const offer = d.bundlePriceCents < d.regularPriceCents && d.offerLabel;
  return {
    x,
    title: fill(x.title, { name: d.parentName.split(" ")[0] }),
    intro: fill(x.intro, { bundle: d.bundleName, date: formatLongDate(d.dueDate, locale) }),
    kept: d.code
      ? fill(x.keptCode, { price: formatMoney(d.regularPriceCents - d.code.offCents), code: d.code.code, regular: formatMoney(d.regularPriceCents) })
      : offer ? fill(x.keptOffer, { price, offer, regular: formatMoney(d.regularPriceCents) }) : fill(x.kept, { price }),
    deposit: d.depositPaidCents ? fill(x.depositPaid, { deposit: formatMoney(d.depositPaidCents) }) : null,
    orText: fill(x.orText, { phone: site.contact.phone }),
    reference: fill(x.reference, { reference: d.reference }),
  };
};

/** "Not born yet": the family's reservation with their due date, and the link to pick their session when the baby arrives. */
export function DueDateReserved({ details: d, theme: t, images, locale, scheduleUrl }: { details: DueReservedDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; scheduleUrl: string }) {
  const { x, title, intro, kept, deposit, orText, reference } = lines(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {deposit ? `${kept} ${deposit}` : kept}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {x.when}
      </Paragraph>
      <ChalkButton theme={t} label={x.button} href={scheduleUrl} variant="solid" />
      <Paragraph theme={t} align="center">
        {orText}
      </Paragraph>
      <Paragraph theme={t} align="center" muted>
        {reference}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function dueReservedEmail(d: DueReservedDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { x, title, intro, kept, deposit, orText, reference } = lines(d, locale);
  const html = await renderHtml(<DueDateReserved details={d} theme={theme} images={images} locale={locale} scheduleUrl={opts.scheduleUrl} />);
  const text = textLines([title, "", intro, "", kept, ...(deposit ? [deposit] : []), "", x.when, fill(x.buttonText, { url: opts.scheduleUrl }), "", orText, "", reference, fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
