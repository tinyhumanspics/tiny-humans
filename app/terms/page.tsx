import type { Metadata } from "next";
import { site } from "@/config/site";
import { depositTerms, fillLegal, termsOfService, travelFeeTerms } from "@/config/legal";
import { getTravelSettings } from "@/lib/travel/server";
import { getDepositSettings, siteDeposit } from "@/lib/deposit/server";
import { depositText } from "@/lib/deposit/copy";
import { formatMoney } from "@/lib/pricing/engine";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import LegalPage from "@/components/LegalPage/LegalPage";
import en from "@/messages/en.json";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: termsOfService.title,
  description: en.seo.termsDescription,
  path: "/terms",
});

const longDate = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));

/**
 * The cancel/reschedule notice and the travel fee come from /admin > Availability, the deposit from /admin > Pricing &
 * Promotions (refreshed when they're saved). While deposits are on, "last updated" is when they were switched (if later).
 */
export default async function TermsPage() {
  const [notice, travel, settings, deposit] = await Promise.all([getNoticeHoursSetting(), getTravelSettings(), getDepositSettings(), siteDeposit()]);
  let terms = travel
    ? { ...termsOfService, sections: termsOfService.sections.map((s) => (s.heading === "Packages and prices" ? { ...s, body: [...s.body, travelFeeTerms] } : s)) }
    : termsOfService;
  if (deposit) {
    terms = depositTerms(terms, { booking: depositText(en.deposit.terms.booking, deposit), refunds: en.deposit.terms.refunds });
    if (settings?.updatedAt && Date.parse(settings.updatedAt) > Date.parse(termsOfService.lastUpdated)) terms = { ...terms, lastUpdated: longDate(settings.updatedAt) };
  }
  const doc = fillLegal(terms, {
    notice: noticeLabel(notice),
    phone: site.contact.phone,
    freeMiles: String(travel?.freeMiles ?? ""),
    maxMiles: String(travel?.maxMiles ?? ""),
    perMile: travel ? formatMoney(travel.perMileCents) : "",
  });
  return <LegalPage doc={doc} other={{ href: "/privacy", label: "Privacy Policy" }} />;
}
