import { defaultLocale, type AppLocale } from "./config";

/** English keeps today's URL; other public languages live below their locale prefix. */
export function localePath(path: string, locale: AppLocale = defaultLocale): string {
  const absolute = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return absolute;
  return absolute === "/" ? `/${locale}` : `/${locale}${absolute}`;
}
