import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { landingParams } from "@/features/landing/params";
import { LANDING_PATH } from "@/config/landing";
import { getSpanishPublication } from "@/i18n/publication";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { siteDeposit } from "@/lib/deposit/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import { getPublicReviews } from "@/lib/reviews/server";
import en from "@/messages/en.json";

export async function generateMetadata(): Promise<Metadata> {
  const spanish = await getSpanishPublication();
  return pageMetadata({
    title: en.landing.meta.title,
    description: en.landing.meta.description,
    path: LANDING_PATH,
    translations: spanish.published,
  });
}

/** The ad landing page (brief 05). ?c=a|b|c picks the headline; the ad's other parameters ride along to /book. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [noticeHours, travel, deposit, reviews, search] = await Promise.all([
    getNoticeHoursSetting(),
    getTravelSettings(),
    siteDeposit(),
    getPublicReviews(),
    searchParams,
  ]);
  const { concept, query } = landingParams(search);
  return (
    <LandingPage
      noticeHours={noticeHours}
      travel={travel}
      deposit={deposit}
      reviews={reviews}
      concept={concept}
      query={query}
      messages={en.landing}
      bundleMessages={en.bundlesPage}
      noticeMessages={en.policy}
      reviewMessages={en.reviewsSection}
      locale="en"
    />
  );
}
