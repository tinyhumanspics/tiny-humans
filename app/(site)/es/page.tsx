import type { Metadata } from "next";
import Hero from "@/features/home/Hero";
import Portfolio from "@/features/home/Portfolio";
import SeasonalOffers from "@/features/seasonal/SeasonalOffers";
import { NotBornYetStrip } from "@/features/booking/NotBornYet";
import Reviews from "@/features/reviews/Reviews";
import { getPublicReviews } from "@/lib/reviews/server";
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

export default async function SpanishHomePage() {
  const reviews = await getPublicReviews();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd("es")) }} />
      <main id="top">
        <Hero messages={es.home.hero} locale="es" />
        <SeasonalOffers messages={es.landing.seasonalOffers} promoMessages={es.bundlesPage.promo} locale="es" />
        <NotBornYetStrip messages={es.dueDate.invite} locale="es" />
        <Portfolio messages={es.home.portfolio} locale="es" />
        {reviews.length > 0 && <Reviews reviews={reviews} messages={es.reviewsSection} placement="home" />}
      </main>
    </>
  );
}
