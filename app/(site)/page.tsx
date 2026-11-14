import type { Metadata } from "next";
import Hero from "@/features/home/Hero";
import Portfolio from "@/features/home/Portfolio";
import SeasonalOffers from "@/features/seasonal/SeasonalOffers";
import QuickPrice from "@/features/booking/QuickPrice";
import Reviews from "@/features/reviews/Reviews";
import { getPublicReviews } from "@/lib/reviews/server";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE, pageMetadata } from "@/lib/seo/metadata";
import { serializeJsonLd, serviceBusinessJsonLd } from "@/lib/seo/structured-data";
import en from "@/messages/en.json";
import { getSpanishPublication } from "@/i18n/publication";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
    translations: (await getSpanishPublication()).published,
  });
}

/** Home: hero, the live seasonal offer boxes (/admin → Seasonal Landing), "Get a quick price", portfolio feed, the reviews picked in /admin. */
export default async function HomePage() {
  const reviews = await getPublicReviews();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd()) }} />
      <main id="top">
        <Hero messages={en.home.hero} dueCta={en.dueDate.invite.button} locale="en" />
        <SeasonalOffers messages={en.landing.seasonalOffers} promoMessages={en.bundlesPage.promo} locale="en" />
        <QuickPrice messages={{ price: en.quickPrice, discount: en.bookingFlow.review.discount, travel: en.bookingFlow.details.travel }} locale="en" />
        <Portfolio messages={en.home.portfolio} locale="en" />
        {reviews.length > 0 && <Reviews reviews={reviews} messages={en.reviewsSection} placement="home" />}
      </main>
    </>
  );
}
