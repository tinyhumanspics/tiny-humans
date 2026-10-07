import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import { formatLongDate } from "@/lib/booking/dates";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkBox, ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  amountCents: number;
  /** The booking's payment link (never expires). */
  payUrl: string;
  /** Session date (studio time zone). */
  date: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

/** "Email the payment link" from /admin: any time, before or after the session. */
export function PaymentLink({ details: d, theme: t, images, locale, amountCents, payUrl, date }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
  const m = emailMessages(locale);
  const x = m.paymentLink;
  const amount = formatMoney(amountCents);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: d.parentName.split(" ")[0] })} />
      <Paragraph theme={t} align="center">
        {x.intro}
      </Paragraph>
      <ChalkBox
        theme={t}
        title={m.afterSession.payTitle}
        rows={[
          [m.common.bundle, d.bundleName],
          [x.session, formatLongDate(date)],
          [m.afterSession.amountDue, amount],
        ]}
        note={x.payNote}
      />
      <ChalkButton theme={t} label={fill(x.payButton, { amount })} href={payUrl} variant="solid" />
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function paymentLinkEmail(d: AfterSessionDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.paymentLink;
  const amount = formatMoney(opts.amountCents);
  const html = await renderHtml(<PaymentLink details={d} theme={theme} images={images} locale={locale} amountCents={opts.amountCents} payUrl={opts.payUrl} date={opts.date} />);
  const text = textLines([
    fill(x.title, { name: d.parentName.split(" ")[0] }),
    "",
    x.intro,
    "",
    `${m.common.bundle}: ${d.bundleName}`,
    `${x.session}: ${formatLongDate(opts.date)}`,
    `${m.afterSession.amountDue}: ${amount}`,
    "",
    fill(x.payText, { amount, url: opts.payUrl }),
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
