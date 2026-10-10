import type { Metadata } from "next";
import { site } from "@/config/site";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { AppLocale } from "@/i18n/config";
import { localePath } from "@/i18n/path";

/** Canonical production origin. Localhost is useful for emails in development, never for search metadata. */
export const PUBLIC_SITE_URL = /^https:\/\//.test(site.url)
  ? site.url.replace(/\/$/, "")
  : "https://www.tinyhumans.photography";

export const DEFAULT_SITE_TITLE = `${site.name} | Newborn & Baby Photography`;
export const DEFAULT_SITE_TITLE_ES = `${site.name} | Fotografía de recién nacidos y bebés`;
export const DEFAULT_SITE_DESCRIPTION = en.seo.defaultDescription;

export const SOCIAL_IMAGE = {
  url: `${PUBLIC_SITE_URL}/og/tiny-humans-og.jpg`,
  secureUrl: `${PUBLIC_SITE_URL}/og/tiny-humans-og.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: en.seo.socialImageAlt,
};

function socialImage(locale: AppLocale) {
  const messages = locale === "es" ? es : en;
  return { ...SOCIAL_IMAGE, alt: messages.seo.socialImageAlt };
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: { default: DEFAULT_SITE_TITLE, template: `%s | ${site.name}` },
  description: DEFAULT_SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_US",
    url: `${PUBLIC_SITE_URL}/`,
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    images: [{ url: SOCIAL_IMAGE.url, alt: SOCIAL_IMAGE.alt }],
  },
};

/** Complete per-page metadata: canonical and social URLs must change together. */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  index = true,
  locale = "en",
  translations = false,
}: {
  title: string;
  description: string;
  path: `/${string}` | "/";
  absoluteTitle?: boolean;
  index?: boolean;
  locale?: AppLocale;
  translations?: boolean;
}): Metadata {
  const url = new URL(localePath(path, locale), `${PUBLIC_SITE_URL}/`).toString();
  const image = socialImage(locale);
  const socialTitle = absoluteTitle ? title : `${title} | ${site.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      ...(translations ? {
        languages: {
          en: new URL(localePath(path, "en"), `${PUBLIC_SITE_URL}/`).toString(),
          es: new URL(localePath(path, "es"), `${PUBLIC_SITE_URL}/`).toString(),
          "x-default": new URL(localePath(path, "en"), `${PUBLIC_SITE_URL}/`).toString(),
        },
      } : {}),
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: locale === "es" ? "es_US" : "en_US",
      url,
      title: socialTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
    ...(!index ? { robots: { index: false, follow: true } } : {}),
  };
}
