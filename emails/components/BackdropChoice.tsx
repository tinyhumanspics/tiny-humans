import { backdropNames } from "@/lib/booking/backdrop-names";
import { emailMessages, fill, type EmailLocale } from "@/lib/email/messages";
import type { EmailTheme } from "@/lib/email/theme";
import { backdropList, type EmailSwatch } from "./backdrops";
import { ChalkButton, Swatches } from "./blocks";

/**
 * "Your backdrop: Burgundy" + Change button when they picked one, else every swatch + "Choose your backdrop"
 * (the backdrop page). Without a link (e.g. the day before) it falls back to "reply with your pick".
 */
export function BackdropChoice({ theme: t, locale, picks, swatches, url, reminder }: { theme: EmailTheme; locale: EmailLocale; picks: string[]; swatches: EmailSwatch[]; url?: string; reminder?: boolean }) {
  const m = emailMessages(locale).backdrops;
  if (picks.length) {
    return (
      <>
        <Swatches theme={t} title={picks.length > 1 ? m.chosenTitleMany : m.chosenTitle} text={fill(m.chosenText, { list: backdropNames(picks) })} swatches={swatches} />
        {url && <ChalkButton theme={t} label={m.change} href={url} variant="outline" />}
      </>
    );
  }
  return (
    <>
      <Swatches theme={t} title={reminder ? m.reminderTitle : m.title} text={url ? (reminder ? m.reminderText : m.text) : m.replyText} swatches={swatches} />
      {url && <ChalkButton theme={t} label={m.choose} href={url} variant="solid" />}
    </>
  );
}

/** The plain-text line for the same section. */
export function backdropTextLine(locale: EmailLocale, picks: string[], url?: string): string {
  const m = emailMessages(locale).backdrops;
  if (picks.length) return url ? fill(m.chosenLine, { list: backdropNames(picks), url }) : `${picks.length > 1 ? m.chosenTitleMany : m.chosenTitle}: ${backdropNames(picks)}.`;
  return url ? fill(m.textLine, { list: backdropList(locale), url }) : fill(m.replyLine, { list: backdropList(locale) });
}
