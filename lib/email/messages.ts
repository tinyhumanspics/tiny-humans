import en from "@/messages/en.json";

/** Email language. Customer emails use the booking's language (Spanish arrives in Phase 3). */
export type EmailLocale = "en";

const MESSAGES = { en: en.emails } as const;

export function emailMessages(locale: EmailLocale = "en") {
  return MESSAGES[locale] ?? MESSAGES.en;
}

/** Fills "{name}" placeholders: fill("Hi {name},", { name: "Ana" }) → "Hi Ana,". Unknown names stay as they are. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
