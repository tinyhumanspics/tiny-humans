import { site } from "@/config/site";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import type { BookingRequestRow } from "@/lib/db/schema";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { formatMoney } from "@/lib/pricing/engine";
import { formatUsMobile } from "@/lib/requests/types";
import { ChalkList, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

interface Options {
  themeId: string;
  locale: EmailLocale;
  /** The bundle's name in the request's language. */
  bundleName: string;
  /** The bundle's deposit (cents); null while deposits are off. */
  depositCents: number | null;
  images?: ImageMode;
}

/** "Thursday, December 10, 2026 at 10:00 am" or "your due date (…)": what the owner will confirm. */
export function requestWhen(r: Pick<BookingRequestRow, "type" | "slotDate" | "slotStart" | "dueDate">, locale: EmailLocale): string {
  const x = emailMessages(locale).requestReceived;
  if (r.type === "due_date" && r.dueDate) return fill(x.whenDue, { date: formatLongDate(r.dueDate, locale) });
  return `${formatLongDate(r.slotDate ?? "", locale)}, ${formatTimeLabel(r.slotStart ?? "", locale)}`;
}

const lines = (r: BookingRequestRow, o: Options) => {
  const x = emailMessages(o.locale).requestReceived;
  const deposit = o.depositCents ? formatMoney(o.depositCents) : null;
  const mobile = formatUsMobile(r.mobile);
  return {
    x,
    preheader: fill(x.preheader, { mobile }),
    title: fill(x.title, { name: r.firstName }),
    intro: fill(x.intro, { mobile, when: requestWhen(r, o.locale) }),
    summary: fill(x.summary, { bundle: o.bundleName, price: formatMoney(r.totalCents) }),
    steps: deposit ? x.steps.map((s) => fill(s, { deposit })) : x.stepsPlain,
    question: fill(x.question, { phone: site.contact.phone }),
  };
};

/** To the parent right after "Send request" (brief 02). The booking confirmation still goes when the deposit is paid. */
export function RequestReceived({ request, theme: t, images, options }: { request: BookingRequestRow; theme: EmailTheme; images: EmailImageSet; options: Options }) {
  const { x, preheader, title, intro, summary, steps, question } = lines(request, options);
  return (
    <ChalkLayout theme={t} images={images} locale={options.locale} preheader={preheader}>
      <Heading theme={t} eyebrow={x.eyebrow} title={title} />
      <Paragraph theme={t} align="center">
        {intro}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {summary}
      </Paragraph>
      <ChalkList theme={t} title={x.next} items={steps} mark="•" />
      <Paragraph theme={t} align="center">
        {x.nothing}
      </Paragraph>
      <Paragraph theme={t} align="center" muted>
        {question}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function requestReceivedEmail(request: BookingRequestRow, options: Options): Promise<RenderedEmail> {
  const theme = emailTheme(options.themeId);
  const images = emailImageSet(theme.id, options.images ?? "cid");
  const { x, title, intro, summary, steps, question } = lines(request, options);
  const html = await renderHtml(<RequestReceived request={request} theme={theme} images={images} options={options} />);
  const text = textLines([title, "", intro, summary, "", x.next, ...steps.map((s, i) => `${i + 1}) ${s}`), "", x.nothing, question, "", fill(emailMessages(options.locale).layout.signature, { email: site.contact.email ?? "" })]);
  return { subject: x.subject, html, text, attachments: images.attachments };
}
