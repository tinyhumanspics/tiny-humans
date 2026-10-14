import type { Metadata } from "next";
import Hero from "@/features/home/Hero";
import Portfolio from "@/features/home/Portfolio";
import { DEFAULT_SITE_TITLE_ES, pageMetadata } from "@/lib/seo/metadata";
import { serializeJsonLd, serviceBusinessJsonLd } from "@/lib/seo/structured-data";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({
  title: DEFAULT_SITE_TITLE_ES,
  description: es.seo.defaultDescription,
  path: "/",
  absoluteTitle: true,
  locale: "es",
  translations: true,
});

export default function SpanishHomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd("es")) }} />
      <main id="top">
        <Hero messages={es.home.hero} locale="es" />
        <Portfolio messages={es.home.portfolio} locale="es" />
      </main>
    </>
  );
}
