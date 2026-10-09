import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage/LegalPage";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({
  title: en.legal.privacy.title,
  description: en.seo.privacyDescription,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage doc={en.legal.privacy} messages={en.legal.shell} other={{ href: "/terms", label: en.legal.shell.terms }} />;
}
