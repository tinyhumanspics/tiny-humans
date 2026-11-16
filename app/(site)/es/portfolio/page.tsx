import type { Metadata } from "next";
import PortfolioPage from "@/features/home/PortfolioPage";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.portfolioPage.meta.title, description: es.portfolioPage.meta.description, path: "/portfolio", locale: "es", translations: true });

/** The Spanish portfolio: the same photo wall. */
export default function Page() {
  return <PortfolioPage messages={es.home.portfolio} cta={es.landing.hero.cta} locale="es" />;
}
