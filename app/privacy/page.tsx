import type { Metadata } from "next";
import { privacyPolicy } from "@/config/legal";
import LegalPage from "@/components/LegalPage/LegalPage";

export const metadata: Metadata = { title: privacyPolicy.title };

export default function PrivacyPage() {
  return <LegalPage doc={privacyPolicy} other={{ href: "/terms", label: "Terms of Service" }} />;
}
