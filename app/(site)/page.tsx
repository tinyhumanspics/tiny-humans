import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { getSpanishPublication } from "@/i18n/publication";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { siteDeposit } from "@/lib/deposit/server";
import { getPublicReviews } from "@/lib/reviews/server";
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE, pageMetadata } from "@/lib/seo/metadata";
import { serializeJsonLd, serviceBusinessJsonLd } from "@/lib/seo/structured-data";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
    translations: (await getSpanishPublication()).published,
  });
}

/** Home (owner, Nov 16): the ad page, with "Miami to Orlando" on top and "Tiny moments. Big memories." as its title. */
export default async function HomePage() {
  const [noticeHours, travel, deposit, reviews] = await Promise.all([getNoticeHoursSetting(), getTravelSettings(), siteDeposit(), getPublicReviews()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceBusinessJsonLd()) }} />
      <LandingPage
        heading={en.home.hero}
        noticeHours={noticeHours}
        travel={travel}
        deposit={deposit}
        reviews={reviews}
        messages={en.landing}
        bundleMessages={en.bundlesPage}
        noticeMessages={en.policy}
        reviewMessages={en.reviewsSection}
        locale="en"
      />
    </>
  );
}
