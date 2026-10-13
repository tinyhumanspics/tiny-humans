import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage/LegalPage";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.legal.privacy.title, description: es.seo.privacyDescription, path: "/privacy", locale: "es", translations: true });

export default function PrivacyPage() {
  return <LegalPage doc={es.legal.privacy} messages={es.legal.shell} other={{ href: "/es/terms", label: es.legal.shell.terms }} />;
}
