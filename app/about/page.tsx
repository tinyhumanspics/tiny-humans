import type { Metadata } from "next";
import en from "@/messages/en.json";
import AboutPage from "@/features/about/AboutPage";
import { siteDeposit } from "@/lib/deposit/server";
import { depositText } from "@/lib/deposit/copy";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: en.about.meta.title,
  description: en.about.meta.description,
  path: "/about",
});

/** The closing call to action mentions the deposit while there is one (saving it in /admin refreshes this page). */
export default async function Page() {
  const deposit = await siteDeposit();
  return <AboutPage messages={en.about} photoMessages={en.photoPlaceholder} locale="en" ctaText={deposit ? depositText(en.deposit.aboutCta, deposit) : en.about.cta.text} />;
}
