import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { AppLocale } from "@/i18n/config";

/** Email language. Customer emails use the language saved with the booking. */
export type EmailLocale = AppLocale;

const MESSAGES: Record<EmailLocale, typeof en.emails> = { en: en.emails, es: es.emails };
const POLICIES: Record<EmailLocale, typeof en.policy> = { en: en.policy, es: es.policy };

export function emailMessages(locale: EmailLocale = "en") {
  return MESSAGES[locale] ?? MESSAGES.en;
}

export function emailPolicy(locale: EmailLocale = "en") {
  return POLICIES[locale] ?? POLICIES.en;
}

/** Fills "{name}" placeholders: fill("Hi {name},", { name: "Ana" }) → "Hi Ana,". Unknown names stay as they are. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
