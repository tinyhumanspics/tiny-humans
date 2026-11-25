import { site } from "@/config/site";
import { addDaysKey } from "@/lib/booking/timezone";
import { formatLongDate, formatTimeLabel, fromDateKey } from "@/lib/booking/dates";
import type { ReminderDetails } from "@/lib/booking/templates";
import { emailChangePolicyText } from "@/lib/email/customer-format";
import { emailImageSet, type EmailImageSet } from "@/lib/email/images";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import { payAfterLine, prepGuideItems } from "@/lib/email/payment";
import { renderHtml, textLines } from "@/lib/email/render";
import { emailTheme, type EmailTheme } from "@/lib/email/theme";
import type { ImageMode, RenderedEmail } from "@/lib/email/types";
import { backdropList, backdropSwatches, type EmailSwatch } from "./components/backdrops";
import { BackdropChoice, backdropTextLine } from "./components/BackdropChoice";
import { ChalkButton, ChalkGroups, ChalkList, Details, Heading, Paragraph, Swatches, type ChalkGroup } from "./components/blocks";
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
  /** Their pay link, while their street or a baby's age is still missing (a booking the owner made, decision #22). */
  homeUrl?: string;
  rescheduleNoticeHours?: number;
  images?: ImageMode;
  locale?: EmailLocale;
}

const sms = `sms:${site.contact.sms}`;

function content(r: ReminderDetails, today: string, locale: EmailLocale) {
  const m = emailMessages(locale);
  const weekday = fromDateKey(r.date).toLocaleDateString(locale === "es" ? "es-US" : "en-US", { weekday: "long" });
  const day = r.date === today ? m.reminder24.today : r.date === addDaysKey(today, 1) ? m.reminder24.tomorrow : weekday;
  return {
    m,
    first: r.parentName.split(" ")[0],
    day,
    weekday,
    date: formatLongDate(r.date, locale),
    start: formatTimeLabel(r.start, locale),
    time: fill(m.common.timeRange, { start: formatTimeLabel(r.start, locale), end: formatTimeLabel(r.end, locale) }),
  };
}

/**
 * The 24-hour reminder's "Before we arrive" (owner, Nov 20): the night before, on the day, and the numbered arrival steps.
 * Sent on the session day itself, the night-before items lead "On the day" without their own heading. The family line
 * shows only when the bundle includes family.
 */
function beforeWeArrive(r: ReminderDetails, today: string, locale: EmailLocale): { title: string; groups: ChalkGroup[] } {
  const b = emailMessages(locale).reminder24.before;
  const night = [...b.night, ...(r.familyBundle ? [fill(b.family, { bundle: r.familyBundle })] : [])];
  const before: ChalkGroup[] = r.date === today ? [{ title: b.dayTitle, items: [...night, ...b.day] }] : [{ title: b.nightTitle, items: night }, { title: b.dayTitle, items: b.day }];
  return { title: b.title, groups: [...before, { title: b.arriveTitle, items: b.arrive, numbered: true }] };
}

type Looks = NonNullable<ReminderDetails["looks"]>;
const looksIntro = (l: Looks) => [l.bundle, l.looks.title].filter(Boolean).join(" · ");

/** What their bundle includes (owner, Nov 25): "Our Little Story · 2 looks", then each look, its name in bold. */
function LooksBox({ theme: t, locale, looks }: { theme: EmailTheme; locale: EmailLocale; looks: Looks }) {
  return <ChalkGroups theme={t} title={emailMessages(locale).looks.title} intro={looksIntro(looks)} groups={[{ items: looks.looks.items, mark: "✓" }]} color={t.yellow} />;
}

function looksLines(locale: EmailLocale, looks: Looks | null | undefined): string[] {
  if (!looks) return [];
  return ["", `${emailMessages(locale).looks.title}: ${looksIntro(looks)}`, ...looks.looks.items.map((i) => `- ${i.name ? `${i.name}: ` : ""}${i.text}`)];
}

/**
 * The 24-hour reminder, when no backdrop is picked yet (owner, Nov 25): the backdrop page has closed by then, so they
 * reply or text their pick (one per setup).
 */
const backdropAsk = (r: ReminderDetails, kind: ReminderKind) => kind === "24h" && !r.backdrops?.length;

function BackdropAsk({ theme: t, locale, setups, swatches }: { theme: EmailTheme; locale: EmailLocale; setups: number; swatches: EmailSwatch[] }) {
  const m = emailMessages(locale).backdrops;
  const many = setups > 1;
  return <Swatches theme={t} title={many ? m.stillTitleMany : m.stillTitle} text={many ? fill(m.stillTextMany, { count: String(setups) }) : m.stillText} swatches={swatches} />;
}

function backdropAskLine(locale: EmailLocale, setups: number): string {
  const m = emailMessages(locale).backdrops;
  return fill(setups > 1 ? m.stillLineMany : m.stillLine, { count: String(setups), list: backdropList(locale) });
}

/** "Two quick things so we come ready" + a button to their link, until their home and every baby's age are saved. */
function AddHome({ theme: t, locale, url }: { theme: EmailTheme; locale: EmailLocale; url: string }) {
  const x = emailMessages(locale).addHome;
  return (
    <>
      <Paragraph theme={t} align="center">
        <b>{x.title}</b>
        <br />
        {x.text}
      </Paragraph>
      <ChalkButton theme={t} label={x.button} href={url} variant="solid" />
    </>
  );
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
  homeUrl,
  swatches,
}: { kind: ReminderKind; details: ReminderDetails; theme: EmailTheme; images: EmailImageSet; locale: EmailLocale; today: string; rescheduleUrl?: string; rescheduleNoticeHours?: number; backdropUrl?: string; homeUrl?: string; swatches: EmailSwatch[] }) {
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
        {homeUrl && <AddHome theme={t} locale={locale} url={homeUrl} />}
        {r.looks && <LooksBox theme={t} locale={locale} looks={r.looks} />}
        <ChalkList theme={t} title={m.prepGuide.title} items={prepGuideItems(locale, Boolean(r.depositPaid))} />
        <BackdropChoice theme={t} locale={locale} picks={r.backdrops ?? []} swatches={swatches} url={backdropUrl} reminder />
        <Paragraph theme={t} align="center">
          <span style={{ display: "block", marginTop: 10, fontSize: 18, fontWeight: "bold" }}>{x.rescheduleTitle}</span>
          {rescheduleUrl && rescheduleNoticeHours !== undefined ? emailChangePolicyText(rescheduleNoticeHours, locale) : x.closed}
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
      {homeUrl && <AddHome theme={t} locale={locale} url={homeUrl} />}
      {r.looks && <LooksBox theme={t} locale={locale} looks={r.looks} />}
      {backdropAsk(r, kind) && (
        <>
          <BackdropAsk theme={t} locale={locale} setups={r.setups ?? 1} swatches={swatches} />
          {textUs}
        </>
      )}
      <ChalkGroups theme={t} {...beforeWeArrive(r, today, locale)} />
      <Paragraph theme={t} align="center">
        {payAfterLine(locale, Boolean(r.depositPaid))}
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
  // the swatches (and their texture attachments): the 72-hour email, and the 24-hour one while none is picked
  const backdrop = kind === "72h" || backdropAsk(r, kind) ? backdropSwatches(locale, opts.images ?? "cid", picks.length ? picks : undefined) : { swatches: [], attachments: [] };
  const { m, first, day, weekday, date, start, time } = content(r, opts.today, locale);
  const html = await renderHtml(
    <SessionReminder kind={kind} details={r} theme={theme} images={images} locale={locale} today={opts.today} rescheduleUrl={opts.rescheduleUrl} rescheduleNoticeHours={opts.rescheduleNoticeHours} backdropUrl={opts.backdropUrl} homeUrl={opts.homeUrl} swatches={backdrop.swatches} />,
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
  const addHome: (string | false)[] = opts.homeUrl ? ["", fill(m.addHome.textLine, { url: opts.homeUrl })] : [];

  if (kind === "72h") {
    const x = m.reminder72;
    const text = textLines([
      fill(x.title, { day: weekday, name: first }),
      "",
      x.intro,
      "",
      ...details(false),
      ...addHome,
      ...looksLines(locale, r.looks),
      "",
      `${m.prepGuide.title}:`,
      ...prepGuideItems(locale, Boolean(r.depositPaid)).map((i) => `- ${i}`),
      "",
      backdropTextLine(locale, picks, opts.backdropUrl),
      "",
      opts.rescheduleUrl && opts.rescheduleNoticeHours !== undefined ? emailChangePolicyText(opts.rescheduleNoticeHours, locale) : `${x.closed} ${textUs}.`,
      opts.rescheduleUrl && fill(x.rescheduleText, { url: opts.rescheduleUrl }),
      "",
      signature,
    ]);
    return { subject: fill(x.subject, { date, time: start }), html, text, attachments: [...images.attachments, ...backdrop.attachments] };
  }

  const x = m.reminder24;
  const before = beforeWeArrive(r, opts.today, locale);
  const text = textLines([
    fill(x.title, { name: first }),
    "",
    fill(x.intro, { day, time: start }),
    "",
    ...details(true),
    ...addHome,
    ...looksLines(locale, r.looks),
    ...(backdropAsk(r, kind) ? ["", `${backdropAskLine(locale, r.setups ?? 1)} ${textUs}.`] : []),
    "",
    before.title,
    ...before.groups.flatMap((g) => ["", `${g.title}:`, ...g.items.map((item, i) => (g.numbered ? `${i + 1}. ${item}` : `- ${item}`))]),
    "",
    payAfterLine(locale, Boolean(r.depositPaid)),
    `${x.reach} ${textUs}.`,
    "",
    signature,
  ]);
  return { subject: fill(x.subject, { day, time: start }), html, text, attachments: [...images.attachments, ...backdrop.attachments] };
}
