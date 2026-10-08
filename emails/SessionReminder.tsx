import { site } from "@/config/site";
import { addDaysKey } from "@/lib/booking/timezone";
import { formatLongDate, formatTimeLabel, fromDateKey } from "@/lib/booking/dates";
import type { ReminderDetails } from "@/lib/booking/templates";
import { changePolicyText } from "@/lib/booking/reschedule-policy";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { backdropSwatches, type EmailSwatch } from "./components/backdrops";
import { BackdropChoice, backdropTextLine } from "./components/BackdropChoice";
import { ChalkButton, ChalkList, Details, Heading, Paragraph } from "./components/blocks";
import { ChalkLayout } from "./components/ChalkLayout";

/** "72h": prep guide + a big reschedule button (lands before the 48 h online cutoff). "24h": logistics. */
export type ReminderKind = "72h" | "24h";

interface Options {
  themeId: string;
  /** Studio-time-zone date the email is sent on ("today" / "tomorrow" wording). */
  today: string;
  /** Online reschedule link, only while rescheduling online is still open. */
  rescheduleUrl?: string;
  /** Backdrop page (pick or change), while it's still more than a day away. */
  backdropUrl?: string;
  rescheduleNoticeHours?: number;
  images?: ImageMode;
  locale?: EmailLocale;
}

const sms = `sms:${site.contact.sms}`;

function content(r: ReminderDetails, today: string, locale: EmailLocale) {
  const m = emailMessages(locale);
  const weekday = fromDateKey(r.date).toLocaleDateString(locale === "en" ? "en-US" : locale, { weekday: "long" });
  const day = r.date === today ? m.reminder24.today : r.date === addDaysKey(today, 1) ? m.reminder24.tomorrow : weekday;
  return {
    m,
    first: r.parentName.split(" ")[0],
    day,
    weekday,
    date: formatLongDate(r.date),
    start: formatTimeLabel(r.start),
    time: fill(m.common.timeRange, { start: formatTimeLabel(r.start), end: formatTimeLabel(r.end) }),
  };
}

export function SessionReminder({
  kind,
  details: r,
  theme: t,
  images,
  locale,
  today,
  rescheduleUrl,
  rescheduleNoticeHours,
  backdropUrl,
  swatches,
}: { kind: ReminderKind; details: ReminderDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; today: string; rescheduleUrl?: string; rescheduleNoticeHours?: number; backdropUrl?: string; swatches: EmailSwatch[] }) {
  const { m, first, day, weekday, date, start, time } = content(r, today, locale);
  const rows: [string, string][] = [
    [m.common.date, date],
    [m.common.time, time],
    [m.common.location, r.location],
    ...(kind === "24h" && r.accessNotes ? [[m.common.access, r.accessNotes] as [string, string]] : []),
    [m.common.bundle, r.bundleName],
    [m.common.reference, r.reference],
  ];
  const textUs = <ChalkButton theme={t} label={fill(m.common.textUs, { phone: site.contact.phone })} href={sms} variant="outline" />;

  if (kind === "72h") {
    const x = m.reminder72;
    return (
      <ChalkLayout theme={t} images={images} locale={locale} preheader={x.preheader}>
        <Heading theme={t} eyebrow={x.eyebrow} title={fill(x.title, { day: weekday, name: first })} />
        <Paragraph theme={t} align="center">
          {x.intro}
        </Paragraph>
        <Details theme={t} rows={rows} />
        <ChalkList theme={t} title={m.prepGuide.title} items={m.prepGuide.items} />
        <BackdropChoice theme={t} locale={locale} picks={r.backdrops ?? []} swatches={swatches} url={backdropUrl} reminder />
        <Paragraph theme={t} align="center">
          <span style={{ display: "block", marginTop: 10, fontSize: 18, fontWeight: "bold" }}>{x.rescheduleTitle}</span>
          {rescheduleUrl && rescheduleNoticeHours !== undefined ? changePolicyText(rescheduleNoticeHours) : x.closed}
        </Paragraph>
        {rescheduleUrl ? <ChalkButton theme={t} label={x.reschedule} href={rescheduleUrl} variant="solid" /> : textUs}
        <Paragraph theme={t} align="center" muted>
          {m.common.questions}
        </Paragraph>
      </ChalkLayout>
    );
  }

  const x = m.reminder24;
  return (
    <ChalkLayout theme={t} images={images} locale={locale} preheader={fill(x.preheader, { day, time: start })}>
      <Heading theme={t} eyebrow={fill(x.eyebrow, { day })} title={fill(x.title, { name: first })} />
      <Paragraph theme={t} align="center">
        {fill(x.intro, { day, time: start })}
      </Paragraph>
      <Details theme={t} rows={rows} />
      <ChalkList theme={t} title={x.checklistTitle} items={x.checklist} />
      <Paragraph theme={t} align="center">
        {m.common.payAfter}
      </Paragraph>
      <Paragraph theme={t} align="center">
        {x.reach}
      </Paragraph>
      {textUs}
      <Paragraph theme={t} align="center" muted>
        {m.common.questions}
      </Paragraph>
    </ChalkLayout>
  );
}

export async function sessionReminderEmail(kind: ReminderKind, r: ReminderDetails, opts: Options): Promise<RenderedEmail> {
  const locale = opts.locale ?? "en";
  const theme = emailTheme(opts.themeId);
  const images = emailImageSet(theme.id, opts.images ?? "cid");
  const picks = r.backdrops ?? [];
  // the swatches (and their texture attachments) only go in the 72-hour email
  const backdrop = kind === "72h" ? backdropSwatches(locale, opts.images ?? "cid", picks.length ? picks : undefined) : { swatches: [], attachments: [] };
  const { m, first, day, weekday, date, start, time } = content(r, opts.today, locale);
  const html = await renderHtml(
    <SessionReminder kind={kind} details={r} theme={theme} images={images} locale={locale} today={opts.today} rescheduleUrl={opts.rescheduleUrl} rescheduleNoticeHours={opts.rescheduleNoticeHours} backdropUrl={opts.backdropUrl} swatches={backdrop.swatches} />,
  );
  const details = (withAccess: boolean): (string | false)[] => [
    `${m.common.date}: ${date}`,
    `${m.common.time}: ${time}`,
    `${m.common.location}: ${r.location}`,
    withAccess && r.accessNotes ? `${m.common.access}: ${r.accessNotes}` : false,
    `${m.common.bundle}: ${r.bundleName}`,
    `${m.common.reference}: ${r.reference}`,
  ];
  const textUs = fill(m.common.textUs, { phone: site.contact.phone });
  const signature = fill(m.layout.signature, { email: site.contact.email ?? "" });

  if (kind === "72h") {
    const x = m.reminder72;
    const text = textLines([
      fill(x.title, { day: weekday, name: first }),
      "",
      x.intro,
      "",
      ...details(false),
      "",
      `${m.prepGuide.title}:`,
      ...m.prepGuide.items.map((i) => `- ${i}`),
      "",
      backdropTextLine(locale, picks, opts.backdropUrl),
      "",
      opts.rescheduleUrl && opts.rescheduleNoticeHours !== undefined ? changePolicyText(opts.rescheduleNoticeHours) : `${x.closed} ${textUs}.`,
      opts.rescheduleUrl && fill(x.rescheduleText, { url: opts.rescheduleUrl }),
      "",
      signature,
    ]);
    return { subject: fill(x.subject, { date, time: start }), html, text, attachments: [...images.attachments, ...backdrop.attachments] };
  }

  const x = m.reminder24;
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    fill(x.intro, { day, time: start }),
    "",
    ...details(true),
    "",
    `${x.checklistTitle}:`,
    ...x.checklist.map((i) => `- ${i}`),
    "",
    m.common.payAfter,
    `${x.reach} ${textUs}.`,
    "",
    signature,
  ]);
  return { subject: fill(x.subject, { day, time: start }), html, text, attachments: images.attachments };
}
