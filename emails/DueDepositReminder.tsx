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

export interface DueDepositReminderDetails {
  parentName: string;
  bundleName: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  amountCents: number;
  /** The bundle price saved with the reservation (the offer's, when one ran the day they reserved). */
  bundlePriceCents: number;
  offerLabel: string | null;
}

interface Options {
  themeId: string;
  /** The family's signed reservation page (it opens Stripe for the deposit). */
  payUrl: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

const lines = (d: DueDepositReminderDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).dueDate.reminder;
  const deposit = formatMoney(d.amountCents);
  const date = formatLongDate(d.dueDate, locale);
  const price = d.offerLabel ? `${formatMoney(d.bundlePriceCents)} (${d.offerLabel})` : formatMoney(d.bundlePriceCents);
  return {
    x,
    preheader: fill(x.preheader, { deposit, bundle: d.bundleName }),
    title: fill(x.title, { name: d.parentName.split(" ")[0] }),
    intro: fill(x.intro, { bundle: d.bundleName, date, deposit }),
    saved: fill(x.saved, { price }),
    button: fill(x.button, { deposit }),
  };
};

/** Sent from /admin → Leads → Not paid (owner, Nov 11): a "Not born yet" family who didn't pay the deposit. */
export function DueDepositReminder({ details: d, theme: t, images, locale, payUrl }: { details: DueDepositReminderDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; payUrl: string }) {
  const { x, preheader, title, intro, saved, button } = lines(d, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {saved}
      </Paragraph>
      <ChalkButton theme={t} label={button} href={payUrl} variant="solid" />
      <Paragraph theme={t} align="center">
        {x.open}
      </Paragraph>
      <Paragraph theme={t} align="center" muted>
        {x.help}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function dueDepositReminderEmail(d: DueDepositReminderDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const { x, title, intro, saved } = lines(d, locale);
  const html = await renderHtml(<DueDepositReminder details={d} theme={theme} images={images} locale={locale} payUrl={opts.payUrl} />);
  const text = textLines([title, "", intro, saved, fill(x.buttonText, { url: opts.payUrl }), "", x.open, "", x.help, fill(emailMessages(locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
