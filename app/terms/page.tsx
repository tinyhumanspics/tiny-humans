import type { Metadata } from "next";
import { site } from "@/config/site";
import { fillLegal, termsOfService, travelFeeTerms } from "@/config/legal";
import { getTravelSettings } from "@/lib/travel/server";
import { formatMoney } from "@/lib/pricing/engine";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import LegalPage from "@/components/LegalPage/LegalPage";

export const metadata: Metadata = { title: termsOfService.title };

/** The cancel/reschedule notice and the travel fee come from /admin > Availability (refreshed when they're saved). */
export default async function TermsPage() {
  const [notice, travel] = await Promise.all([getNoticeHoursSetting(), getTravelSettings()]);
  const terms = travel
    ? { ...termsOfService, sections: termsOfService.sections.map((s) => (s.heading === "Packages and prices" ? { ...s, body: [...s.body, travelFeeTerms] } : s)) }
    : termsOfService;
  const doc = fillLegal(terms, {
    notice: noticeLabel(notice),
    phone: site.contact.phone,
    freeMiles: String(travel?.freeMiles ?? ""),
    maxMiles: String(travel?.maxMiles ?? ""),
    perMile: travel ? formatMoney(travel.perMileCents) : "",
  });
  return <LegalPage doc={doc} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
