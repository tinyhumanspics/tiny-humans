import { site } from "@/config/site";
import { formatMoney } from "@/lib/pricing/engine";
import type { AfterSessionDetails } from "@/lib/booking/templates";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { deliveryText, lineName } from "@/lib/photo-extras/format";
import type { ExtraLine } from "@/lib/photo-extras/types";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { ChalkBox, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  lines: ExtraLine[];
  creditCents: number;
  totalCents: number;
  images?: ImageMode;
  locale?: EmailLocale;
}

/** One row per line: "Extra edited photos × 4" → "$52 · arrives within 72 hours"; then the credit, then what they paid. */
function rows(locale: EmailLocale, o: Pick<Options, "lines" | "creditCents" | "totalCents">): [string, string][] {
  const x = emailMessages(locale).extrasPaid;
  const names = (locale === "es" ? es : en).extras;
  return [
    ...o.lines.map((l): [string, string] => [lineName(l, names), fill(x.line, { amount: formatMoney(l.totalCents), when: deliveryText(l.delivery, names) })]),
    ...(o.creditCents > 0 ? [[x.credit, `−${formatMoney(o.creditCents)}`] as [string, string]] : []),
    [x.paid, formatMoney(o.totalCents)],
  ];
}

/** The family's thank-you once their photo extras are paid (owner, Nov 20): what they added and when it arrives. */
export function PhotoExtrasPaid({ details: d, theme: t, images, locale, lines, creditCents, totalCents }: { details: AfterSessionDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale } & Omit<Options, "themeId" | "images" | "locale">) {
  const m = emailMessages(locale);
  const x = m.extrasPaid;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { name: d.parentName.split(" ")[0] })} />
      <Paragraph theme={t} align="center">
        {x.intro}
      </Paragraph>
      <ChalkBox theme={t} title={x.listTitle} rows={rows(locale, { lines, creditCents, totalCents })} note={x.note} />
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function photoExtrasPaidEmail(d: AfterSessionDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const m = emailMessages(locale);
  const x = m.extrasPaid;
  const first = d.parentName.split(" ")[0];
  const html = await renderHtml(<PhotoExtrasPaid details={d} theme={theme} images={images} locale={locale} lines={opts.lines} creditCents={opts.creditCents} totalCents={opts.totalCents} />);
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    x.intro,
    "",
    ...rows(locale, opts).map(([k, v]) => `${k}: ${v}`),
    "",
    x.note,
    "",
    m.common.questions,
    fill(m.layout.signature, { email: site.contact.email ?? "" }),
  ]);
  return { subject: fill(x.subject, { name: first }), html, text, attachments: images.attachments };
}
