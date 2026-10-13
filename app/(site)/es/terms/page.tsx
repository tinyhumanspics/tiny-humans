import type { Metadata } from "next";
import TermsPageContent from "@/features/legal/TermsPage";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.legal.terms.title, description: es.seo.termsDescription, path: "/terms", locale: "es", translations: true });

export default function TermsPage() {
  return <TermsPageContent locale="es" messages={es.legal} depositMessages={es.deposit.terms} policyMessages={es.policy} />;
}
