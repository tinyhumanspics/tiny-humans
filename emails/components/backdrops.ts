import { BACKDROPS } from "@/config/backdrops";
import { emailMessages, type EmailLocale } from "@/lib/email/messages";

/** The backdrop swatches with their names in the email's language. */
export function backdropSwatches(locale: EmailLocale) {
  const names = emailMessages(locale).backdrops.names;
  return BACKDROPS.map((b) => ({ name: names[b.id], color: b.color, glow: b.glow, edge: b.edge }));
}

/** "Blue Aura, Burgundy, Cream or White" (plain-text versions). */
export function backdropList(locale: EmailLocale): string {
  const m = emailMessages(locale).backdrops;
  const names = BACKDROPS.map((b) => m.names[b.id]);
  return `${names.slice(0, -1).join(", ")} ${m.or} ${names[names.length - 1]}`;
}
