import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  /** Review form on our site. */
  reviewUrl: string;
  /** The Pixieset gallery link, if the owner pasted it. */
  galleryUrl?: string;
  /** Still unpaid: amount + our /pay link. */
  pay?: { amountCents: number; url: string } | null;
  images?: ImageMode;
  locale?: EmailLocale;
}

const siteName = () => site.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** "Gallery delivered": we hope you love them + review request + referral (+ a pay button while still unpaid). */
export function GalleryDelivered({ details: d, theme: t, images, locale, reviewUrl, galleryUrl, pay }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
  const m = emailMessages(locale);
  const x = m.gallery;
  const first = d.parentName.split(" ")[0];
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {x.intro}
      </Paragraph>
      {galleryUrl ? (
        <ChalkButton theme={t} label={x.viewGallery} href={galleryUrl} variant="solid" />
      ) : (
        <Paragraph theme={t} align="center">
          {x.pixieset}
        </Paragraph>
      )}
      <Paragraph theme={t} align="center">
        <span style={{ display: "block", marginTop: 14, fontSize: 20, fontWeight: "bold" }}>{x.reviewTitle}</span>
        {x.reviewText}
      </Paragraph>
      <ChalkButton theme={t} label={x.reviewButton} href={reviewUrl} variant={galleryUrl ? "outline" : "solid"} />
      <Paragraph theme={t} align="center">
        <span style={{ display: "block", marginTop: 14, fontSize: 18, fontWeight: "bold" }}>{x.referralTitle}</span>
        {fill(x.referralText, { site: siteName() })}
      </Paragraph>
      {pay && pay.amountCents > 0 && (
        <>
          <Paragraph theme={t} align="center" muted>
            {fill(x.payReminder, { amount: formatMoney(pay.amountCents) })}
          </Paragraph>
          <ChalkButton theme={t} label={fill(x.payButton, { amount: formatMoney(pay.amountCents) })} href={pay.url} variant="outline" />
        </>
      )}
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function galleryDeliveredEmail(d: AfterSessionDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.gallery;
  const first = d.parentName.split(" ")[0];
  const html = await renderHtml(<GalleryDelivered details={d} theme={theme} images={images} locale={locale} reviewUrl={opts.reviewUrl} galleryUrl={opts.galleryUrl} pay={opts.pay} />);
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    x.intro,
    opts.galleryUrl ? fill(x.galleryText, { url: opts.galleryUrl }) : x.pixieset,
    "",
    x.reviewTitle,
    x.reviewText,
    fill(x.reviewTextLine, { url: opts.reviewUrl }),
    "",
    x.referralTitle,
    fill(x.referralText, { site: siteName() }),
    !!opts.pay && opts.pay.amountCents > 0 && `\n${fill(x.payText, { amount: formatMoney(opts.pay.amountCents), url: opts.pay.url })}`,
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { name: first }), html, text, attachments: images.attachments };
}
