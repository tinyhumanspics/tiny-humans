import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { siteDeposit } from "@/lib/deposit/server";
import { getPublicReviews } from "@/lib/reviews/server";
import { DEFAULT_SITE_TITLE_ES, pageMetadata } from "@/lib/seo/metadata";
import { serializeJsonLd, serviceBusinessJsonLd } from "@/lib/seo/structured-data";
import { getTravelSettings } from "@/lib/travel/server";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({
  title: DEFAULT_SITE_TITLE_ES,
  description: es.seo.defaultDescription,
  path: "/",
  absoluteTitle: true,
  locale: "es",
  translations: true,
});

/** Home (owner, Nov 16): the ad page, with "Tiny moments. Big memories." as its title. */
export default async function SpanishHomePage() {
  const [noticeHours, travel, deposit, reviews] = await Promise.all([getNoticeHoursSetting(), getTravelSettings(), siteDeposit(), getPublicReviews()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd("es")) }} />
      <LandingPage
        headline={es.home.hero.title}
        noticeHours={noticeHours}
        travel={travel}
        deposit={deposit}
        reviews={reviews}
        messages={es.landing}
        bundleMessages={es.bundlesPage}
        noticeMessages={es.policy}
        reviewMessages={es.reviewsSection}
        locale="es"
      />
    </>
  );
}
