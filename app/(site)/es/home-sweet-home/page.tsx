import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { landingParams } from "@/features/landing/params";
import { LANDING_PATH } from "@/config/landing";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { siteDeposit } from "@/lib/deposit/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import { getPublicReviews } from "@/lib/reviews/server";
import es from "@/messages/es.json";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: es.landing.meta.title,
    description: es.landing.meta.description,
    path: LANDING_PATH,
    locale: "es",
    translations: true,
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
      messages={es.landing}
      bundleMessages={es.bundlesPage}
      noticeMessages={es.policy}
      reviewMessages={es.reviewsSection}
      locale="es"
    />
  );
}
