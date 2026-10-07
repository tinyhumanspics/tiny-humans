import type { Metadata } from "next";
import { site } from "@/config/site";
import { fillLegal, termsOfService } from "@/config/legal";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import LegalPage from "@/components/LegalPage/LegalPage";

export const metadata: Metadata = { title: termsOfService.title };

/** The cancel/reschedule notice comes from /admin > Availability (refreshed when it's saved). */
export default async function TermsPage() {
  const doc = fillLegal(termsOfService, { notice: noticeLabel(await getNoticeHoursSetting()), phone: site.contact.phone });
  return <LegalPage doc={doc} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
