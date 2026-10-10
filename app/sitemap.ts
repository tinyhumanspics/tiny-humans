import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/seo/metadata";
import { getSpanishPublication } from "@/i18n/publication";
import { localePath } from "@/i18n/path";

const INDEXABLE_PATHS = ["/", "/about", "/bundles", "/home-sweet-home", "/privacy", "/terms"] as const;

/** Only canonical public pages belong here; booking/manage/admin/API URLs are intentionally excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spanish = (await getSpanishPublication()).published;
  return INDEXABLE_PATHS.flatMap((path) => {
    const languages = {
      en: new URL(localePath(path, "en"), `${PUBLIC_SITE_URL}/`).toString(),
      es: new URL(localePath(path, "es"), `${PUBLIC_SITE_URL}/`).toString(),
    };
    const entry = (locale: "en" | "es") => ({
      url: languages[locale],
      ...(spanish ? { alternates: { languages: { ...languages, "x-default": languages.en } } } : {}),
    });
    return spanish ? [entry("en"), entry("es")] : [entry("en")];
  });
}
