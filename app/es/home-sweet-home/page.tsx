import type { Metadata } from "next";
import LandingPage from "@/features/landing/LandingPage";
import { LANDING_PATH } from "@/config/landing";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { depositText } from "@/lib/deposit/copy";
import { siteDeposit } from "@/lib/deposit/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import es from "@/messages/es.json";

export async function generateMetadata(): Promise<Metadata> {
  const deposit = await siteDeposit();
  return pageMetadata({
    title: es.landing.meta.title,
    description: deposit ? depositText(es.deposit.landing.metaDescription, deposit) : es.landing.meta.description,
    path: LANDING_PATH,
    locale: "es",
    translations: true,
  });
}

export default async function Page() {
  const [noticeHours, travel, deposit] = await Promise.all([getNoticeHoursSetting(), getTravelSettings(), siteDeposit()]);
  return <LandingPage noticeHours={noticeHours} travel={travel} deposit={deposit} messages={es.landing} bundleMessages={es.bundlesPage} photoMessages={es.photoPlaceholder} depositMessages={es.deposit.landing} noticeMessages={es.policy} locale="es" />;
}
