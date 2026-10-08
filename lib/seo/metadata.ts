import type { Metadata } from "next";
import { site } from "@/config/site";
import en from "@/messages/en.json";

/** Canonical production origin. Localhost is useful for emails in development, never for search metadata. */
export const PUBLIC_SITE_URL = /^https:\/\//.test(site.url)
  ? site.url.replace(/\/$/, "")
  : "https://www.tinyhumans.photography";

export const DEFAULT_SITE_TITLE = `${site.name} | Newborn & Baby Photography`;
export const DEFAULT_SITE_DESCRIPTION = en.seo.defaultDescription;

export const SOCIAL_IMAGE = {
  url: `${PUBLIC_SITE_URL}/og/tiny-humans-og.jpg`,
  secureUrl: `${PUBLIC_SITE_URL}/og/tiny-humans-og.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: en.seo.socialImageAlt,
};

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
}: {
  title: string;
  description: string;
  path: `/${string}` | "/";
  absoluteTitle?: boolean;
  index?: boolean;
}): Metadata {
  const url = new URL(path, `${PUBLIC_SITE_URL}/`).toString();
  const socialTitle = absoluteTitle ? title : `${title} | ${site.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      url,
      title: socialTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [{ url: SOCIAL_IMAGE.url, alt: SOCIAL_IMAGE.alt }],
    },
    ...(!index ? { robots: { index: false, follow: true } } : {}),
  };
}
