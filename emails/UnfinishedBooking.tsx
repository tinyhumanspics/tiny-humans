import { site } from "@/config/site";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkButton, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Details {
  parentName: string;
  /** The bundle they were booking, in the email's language (null = we don't know). */
  bundleName: string | null;
}

interface Options {
  themeId: string;
  /** "What stopped you?" page (/feedback?t=…). */
  feedbackUrl: string;
  /** Back to the booking calendar for the same bundle. */
  bookUrl: string;
  unsubscribeUrl: string;
  /** Required by CAN-SPAM in every marketing email. */
  mailingAddress: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

const firstName = (name: string) => name.trim().split(" ")[0] ?? "";

/** The one follow-up the owner sends from /admin → Unfinished bookings: "What stopped you?" (a marketing email). */
export function UnfinishedBooking({ details: d, theme: t, images, locale, feedbackUrl, bookUrl, unsubscribeUrl, mailingAddress }: { details: Details; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
  const x = emailMessages(locale).unfinished;
  const name = firstName(d.parentName);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader} marketing={{ note: x.adNote, unsubscribeLabel: x.unsubscribe, unsubscribeUrl, mailingAddress }}>
      <Heading theme={t} eyebrow={x.eyebrow} title={name ? fill(x.title, { name }) : x.titleNoName} />
      <Paragraph theme={t} align="center">
        {d.bundleName ? fill(x.intro, { bundle: d.bundleName }) : x.introNoBundle}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {x.ask}
      </Paragraph>
      <ChalkButton theme={t} label={x.askButton} href={feedbackUrl} variant="solid" />
      <Paragraph theme={t} align="center">
        <span style={{ display: "block", marginTop: 14, fontSize: 18, fontWeight: "bold" }}>{x.bookTitle}</span>
        {x.bookText}
      </Paragraph>
      <ChalkButton theme={t} label={x.bookButton} href={bookUrl} variant="outline" />
      <Paragraph theme={t} align="center" muted>
        {emailMessages(locale).common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function unfinishedFollowUpEmail(d: Details, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.unfinished;
  const name = firstName(d.parentName);
  const html = await renderHtml(<UnfinishedBooking details={d} theme={theme} images={images} locale={locale} feedbackUrl={opts.feedbackUrl} bookUrl={opts.bookUrl} unsubscribeUrl={opts.unsubscribeUrl} mailingAddress={opts.mailingAddress} />);
  const text = textLines([
    name ? fill(x.title, { name }) : x.titleNoName,
    "",
    d.bundleName ? fill(x.intro, { bundle: d.bundleName }) : x.introNoBundle,
    "",
    x.ask,
    fill(x.askLine, { url: opts.feedbackUrl }),
    "",
    x.bookTitle,
    x.bookText,
    fill(x.bookLine, { url: opts.bookUrl }),
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
    "",
    x.adNote,
    opts.mailingAddress,
    fill(x.unsubscribeLine, { url: opts.unsubscribeUrl }),
  ]);
  return { subject: name ? fill(x.subject, { name }) : x.subjectNoName, html, text, attachments: images.attachments };
}
