import type { Metadata } from "next";
import PortfolioPage from "@/features/home/PortfolioPage";
import { getSpanishPublication } from "@/i18n/publication";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: en.portfolioPage.meta.title, description: en.portfolioPage.meta.description, path: "/portfolio", translations: (await getSpanishPublication()).published });
}

/** The portfolio (owner, Nov 16): only the babies' photos, as a photo wall. */
export default function Page() {
  return <PortfolioPage messages={en.home.portfolio} cta={en.landing.hero.cta} locale="en" />;
}
