import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage/LegalPage";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";
import { getSpanishPublication } from "@/i18n/publication";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: en.legal.privacy.title,
    description: en.seo.privacyDescription,
    path: "/privacy",
    translations: (await getSpanishPublication()).published,
  });
}

export default function PrivacyPage() {
  return <LegalPage doc={en.legal.privacy} messages={en.legal.shell} other={{ href: "/terms", label: en.legal.shell.terms }} />;
}
