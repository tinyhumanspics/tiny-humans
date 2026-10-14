import "server-only";
import { SiteSettingsProvider } from "@/components/providers/SiteSettingsProvider";
import { CatalogProvider } from "@/components/providers/CatalogProvider";
import SeasonalDecor from "@/components/layout/SeasonalDecor/SeasonalDecor";
import Header from "@/components/layout/Header/Header";
import Footer from "@/components/layout/Footer/Footer";
import MetaPixel from "@/components/layout/MetaPixel";
import { getSiteSettings } from "@/lib/settings/server";
import { getPublicCatalog } from "@/lib/pricing/server";
import { publicDeposits } from "@/lib/deposit/server";
import { todayInZone } from "@/lib/booking/timezone";
import { bookingRules } from "@/config/booking";
import { getPublicLocale, getSpanishPublication } from "@/i18n/publication";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The site's frame: settings + catalog providers, seasonal decor, header, footer and Meta Pixel. Drawn by the (site)
 * and (admin) layouts, and by `app/not-found.tsx` (the 404 renders inside the root layout only).
 */
export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const [settings, englishCatalog, spanishPublication, deposits, locale] = await Promise.all([
    getSiteSettings(),
    getPublicCatalog(),
    getSpanishPublication(),
    publicDeposits(),
    getPublicLocale(),
  ]);
  const messages = locale === "es" ? es : en;
  const catalog = locale === "es" ? spanishPublication.catalog! : englishCatalog;
  return (
    <SiteSettingsProvider initial={settings} locale={locale}>
      <CatalogProvider initial={catalog.bundles} status={catalog.status} initialToday={todayInZone(bookingRules.timeZone)} deposits={deposits}>
        <SeasonalDecor />
        {/* Header lives in a layout so the logo intro never replays between pages. */}
        <Header messages={messages.header} languageMessages={messages.language} locale={locale} showLanguageSwitcher={spanishPublication.published} />
        {children}
        <Footer messages={messages.footer} languageMessages={messages.language} locale={locale} showLanguageSwitcher={spanishPublication.published} />
        <MetaPixel />
      </CatalogProvider>
    </SiteSettingsProvider>
  );
}
