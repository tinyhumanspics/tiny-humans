import type { Metadata } from "next";
import en from "@/messages/en.json";
import { LANDING_PATH } from "@/config/landing";
import LandingPage from "@/features/landing/LandingPage";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { siteDeposit } from "@/lib/deposit/server";
import { depositText } from "@/lib/deposit/copy";
import { getTravelSettings } from "@/lib/travel/server";
import { pageMetadata } from "@/lib/seo/metadata";

/** The description mentions the deposit while there is one (saving it in /admin refreshes this page). */
export async function generateMetadata(): Promise<Metadata> {
  const deposit = await siteDeposit();
  const description = deposit ? depositText(en.deposit.landing.metaDescription, deposit) : en.landing.meta.description;
  return pageMetadata({
    title: en.landing.meta.title,
    description,
    path: LANDING_PATH,
  });
}

export default async function Page() {
  const [noticeHours, travel, deposit] = await Promise.all([getNoticeHoursSetting(), getTravelSettings(), siteDeposit()]);
  return (
    <LandingPage
      noticeHours={noticeHours}
      travel={travel}
      deposit={deposit}
      messages={en.landing}
      bundleMessages={en.bundlesPage}
      photoMessages={en.photoPlaceholder}
      depositMessages={en.deposit.landing}
      noticeMessages={en.policy}
      locale="en"
    />
  );
}
