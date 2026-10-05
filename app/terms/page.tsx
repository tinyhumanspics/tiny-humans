import type { Metadata } from "next";
import { termsOfService } from "@/config/legal";
import LegalPage from "@/components/LegalPage/LegalPage";

export const metadata: Metadata = { title: termsOfService.title };

export default function TermsPage() {
  return <LegalPage doc={termsOfService} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
