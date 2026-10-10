/** Languages offered to families. The owner area and internal studio messages stay in English. */
export const locales = ["en", "es"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

/** Trusted request header set by our own proxy from the public pathname. */
export const PUBLIC_LOCALE_HEADER = "x-tiny-humans-locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function appLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
