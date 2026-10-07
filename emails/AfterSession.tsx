import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { ChalkBox, ChalkButton, ChalkList, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  /** Exact amount still due (cents). 0 = nothing to pay. */
  amountCents: number;
  /** Our /pay link (opens a Stripe payment page for the exact amount). */
  payUrl?: string;
  images?: ImageMode;
  locale?: EmailLocale;
}

/** "Session done": thank-you, what happens next and how to pay (sent when the owner taps "Session done" in /admin). */
export function AfterSession({ details: d, theme: t, images, locale, amountCents, payUrl }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; amountCents: number; payUrl?: string }) {
  const m = emailMessages(locale);
  const x = m.afterSession;
  const first = d.parentName.split(" ")[0];
  const amount = formatMoney(amountCents);
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {fill(x.intro, { baby: d.babyName || m.confirmation.babyFallback })}
      </Paragraph>
      <ChalkList theme={t} title={x.nextTitle} items={x.next} color={t.chalk} mark="•" />
      {amountCents > 0 && payUrl ? (
        <>
          <ChalkBox
            theme={t}
            title={x.payTitle}
            rows={[
              [m.common.bundle, d.bundleName],
              [x.amountDue, amount],
            ]}
            note={x.payNote}
          />
          <ChalkButton theme={t} label={fill(x.payButton, { amount })} href={payUrl} variant="solid" />
        </>
      ) : (
        <Paragraph theme={t} align="center">
          {x.nothingDue}
        </Paragraph>
      )}
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function afterSessionEmail(d: AfterSessionDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.afterSession;
  const first = d.parentName.split(" ")[0];
  const amount = formatMoney(opts.amountCents);
  const html = await renderHtml(<AfterSession details={d} theme={theme} images={images} locale={locale} amountCents={opts.amountCents} payUrl={opts.payUrl} />);
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    fill(x.intro, { baby: d.babyName || m.confirmation.babyFallback }),
    "",
    `${x.nextTitle}:`,
    ...x.next.map((i) => `- ${i}`),
    "",
    opts.amountCents > 0 && opts.payUrl ? `${x.amountDue}: ${amount} (${d.bundleName})` : x.nothingDue,
    opts.amountCents > 0 && opts.payUrl && fill(x.payText, { amount, url: opts.payUrl }),
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { name: first }), html, text, attachments: images.attachments };
}
