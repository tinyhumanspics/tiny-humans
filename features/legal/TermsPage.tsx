import { site } from "@/config/site";
import { depositTerms, fillLegal, travelTerms, type LegalDocument, type LegalDynamicCopy } from "@/config/legal";
import { getTravelSettings } from "@/lib/travel/server";
import { getDepositSettings, siteDeposit } from "@/lib/deposit/server";
import { depositText } from "@/lib/deposit/copy";
import { formatMoney } from "@/lib/pricing/engine";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { noticeLabel } from "@/lib/booking/reschedule-policy";
import LegalPage from "@/components/LegalPage/LegalPage";
import { localePath } from "@/i18n/path";
import type { AppLocale } from "@/i18n/config";
import en from "@/messages/en.json";

interface Props {
  locale: AppLocale;
  messages: typeof en.legal;
  depositMessages: typeof en.deposit.terms;
  policyMessages: typeof en.policy;
}

const updatedDate = (iso: string, locale: AppLocale) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

/** Locale-ready Terms page with the current notice, travel and deposit settings from /admin. */
export default async function TermsPageContent({ locale, messages, depositMessages, policyMessages }: Props) {
  const [notice, travel, settings, deposit] = await Promise.all([
    getNoticeHoursSetting(),
    getTravelSettings(),
    getDepositSettings(),
    siteDeposit(),
  ]);
  const dynamic = messages.dynamic as LegalDynamicCopy;
  let terms = messages.terms as LegalDocument;
  if (travel) terms = travelTerms(terms, dynamic.travelFee);
  if (deposit) {
    terms = depositTerms(terms, dynamic, {
      booking: depositText(depositMessages.booking, deposit),
      refunds: depositMessages.refunds,
    });
    if (settings?.updatedAt && Date.parse(settings.updatedAt) > Date.parse(messages.terms.lastUpdatedIso)) {
      terms = { ...terms, lastUpdated: updatedDate(settings.updatedAt, locale) };
    }
  }
  const doc = fillLegal(terms, {
    notice: noticeLabel(notice, policyMessages),
    phone: site.contact.phone,
    freeMiles: String(travel?.freeMiles ?? ""),
    maxMiles: String(travel?.maxMiles ?? ""),
    perMile: travel ? formatMoney(travel.perMileCents) : "",
  });
  return (
    <LegalPage
      doc={doc}
      messages={messages.shell}
      other={{ href: localePath("/privacy", locale), label: messages.shell.privacy }}
    />
  );
}
