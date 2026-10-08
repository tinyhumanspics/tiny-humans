import type { Metadata } from "next";
import { privacyPolicy } from "@/config/legal";
import LegalPage from "@/components/LegalPage/LegalPage";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({
  title: privacyPolicy.title,
  description: en.seo.privacyDescription,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage doc={privacyPolicy} other={{ href: "/terms", label: "Terms of Service" }} />;
}
