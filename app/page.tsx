import type { Metadata } from "next";
import Hero from "@/components/Hero/Hero";
import Portfolio from "@/components/Portfolio/Portfolio";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE, pageMetadata } from "@/lib/seo/metadata";
import { serializeJsonLd, serviceBusinessJsonLd } from "@/lib/seo/structured-data";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({
  title: DEFAULT_SITE_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

/** Home: hero + portfolio feed. Booking lives on /book. */
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd()) }} />
      <main id="top">
        <Hero messages={en.home.hero} locale="en" />
        <Portfolio messages={en.home.portfolio} locale="en" />
      </main>
    </>
  );
}
