import { defaultLocale, type AppLocale } from "./config";

/** English keeps today's URL; other public languages live below their locale prefix. */
export function localePath(path: string, locale: AppLocale = defaultLocale): string {
  const absolute = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return absolute;
  return absolute === "/" ? `/${locale}` : `/${locale}${absolute}`;
}

/** Remove a supported locale prefix before rebuilding the same public pathname in another language. */
export function publicPathname(pathname: string): string {
  for (const locale of ["es"] as const) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname || "/";
}

export function switchLocalePath(pathname: string, locale: AppLocale): string {
  return localePath(publicPathname(pathname), locale);
}
