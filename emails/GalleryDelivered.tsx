import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { BODY_FONT, CHALK_FONT, ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  /** Review form on our site. */
  reviewUrl: string;
  /** The Pixieset gallery link, if the owner pasted it. */
  galleryUrl?: string;
  /** The gallery's download PIN, if the owner typed it (only in this email, never saved). */
  downloadPin?: string;
  /** Still unpaid: amount + our /pay link. */
  pay?: { amountCents: number; url: string } | null;
  images?: ImageMode;
  locale?: EmailLocale;
}

const siteName = () => site.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** "Gallery delivered": we hope you love them + review request + referral (+ a pay button while still unpaid). */
/** The download PIN in a dashed box under the gallery button. */
function PinBox({ theme: t, title, text }: { theme: EmailTheme; title: string; text: string }) {
  return (
    <tr>
      <td className="th-pad" align="center" style={{ padding: "18px 36px 0" }}>
        <table role="presentation" cellPadding="0" cellSpacing="0" border={0} align="center" style={{ border: `2px dashed ${t.yellow}`, borderRadius: 10 }}>
          <tr>
            <td align="center" style={{ padding: "12px 22px" }}>
              <p style={{ margin: 0, fontFamily: CHALK_FONT, fontSize: 22, lineHeight: 1.3, color: t.yellow }}>{title}</p>
              <p style={{ margin: "6px 0 0", fontFamily: BODY_FONT, fontSize: 14, lineHeight: 1.5, color: t.chalk }}>{text}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  );
}

export function GalleryDelivered({ details: d, theme: t, images, locale, reviewUrl, galleryUrl, downloadPin, pay }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
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
      {downloadPin && <PinBox theme={t} title={fill(x.pinTitle, { pin: downloadPin })} text={x.pinText} />}
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
  const html = await renderHtml(<GalleryDelivered details={d} theme={theme} images={images} locale={locale} reviewUrl={opts.reviewUrl} galleryUrl={opts.galleryUrl} downloadPin={opts.downloadPin} pay={opts.pay} />);
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    x.intro,
    opts.galleryUrl ? fill(x.galleryText, { url: opts.galleryUrl }) : x.pixieset,
    !!opts.downloadPin && `${fill(x.pinTitle, { pin: opts.downloadPin })}\n${x.pinText}`,
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
