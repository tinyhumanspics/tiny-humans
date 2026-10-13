import type { Metadata } from "next";
import TermsPageContent from "@/features/legal/TermsPage";
import en from "@/messages/en.json";
import { pageMetadata } from "@/lib/seo/metadata";
import { getSpanishPublication } from "@/i18n/publication";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: en.legal.terms.title,
    description: en.seo.termsDescription,
    path: "/terms",
    translations: (await getSpanishPublication()).published,
  });
}

/** Live English terms; the shared server component is ready for the future reviewed Spanish route. */
export default function TermsPage() {
  return <TermsPageContent locale="en" messages={en.legal} depositMessages={en.deposit.terms} policyMessages={en.policy} />;
}
