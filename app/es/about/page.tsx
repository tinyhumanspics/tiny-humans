import type { Metadata } from "next";
import AboutPage from "@/features/about/AboutPage";
import { depositText } from "@/lib/deposit/copy";
import { siteDeposit } from "@/lib/deposit/server";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({
  title: es.about.meta.title,
  description: es.about.meta.description,
  path: "/about",
  locale: "es",
  translations: true,
});

export default async function Page() {
  const deposit = await siteDeposit();
  return <AboutPage messages={es.about} photoMessages={es.photoPlaceholder} locale="es" ctaText={deposit ? depositText(es.deposit.aboutCta, deposit) : es.about.cta.text} />;
}
