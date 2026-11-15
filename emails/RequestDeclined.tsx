import { site } from "@/config/site";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  locale: EmailLocale;
  images?: ImageMode;
}

/** What the decline email needs: their first name and what they asked for (`when`, in their language). */
export interface DeclinedDetails {
  firstName: string;
  when: string;
}

const lines = (d: DeclinedDetails, locale: EmailLocale) => {
  const x = emailMessages(locale).requestDeclined;
  return { x, title: fill(x.title, { name: d.firstName }), body: fill(x.body, { when: d.when }), other: fill(x.other, { phone: site.contact.phone }) };
};

/** The optional polite note when the owner declines a request (/admin → Requests → Decline). */
export function RequestDeclined({ details, theme: t, images, locale }: { details: DeclinedDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale }) {
  const { x, title, body, other } = lines(details, locale);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {body}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {other}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function requestDeclinedEmail(details: DeclinedDetails, options: Options): Promise<RenderedEmail> {
  const theme = emailTheme(options.themeId);
  const images = emailImageSet(theme.id, options.images ?? "cid");
  const { x, title, body, other } = lines(details, options.locale);
  const html = await renderHtml(<RequestDeclined details={details} theme={theme} images={images} locale={options.locale} />);
  const text = textLines([title, "", body, other, "", fill(emailMessages(options.locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
