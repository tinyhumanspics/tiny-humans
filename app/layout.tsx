import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getTheme, themeCssVariables } from "@/config/themes";
import { getSiteSettings } from "@/lib/settings/server";
import { SiteSettingsProvider } from "@/components/SiteSettings/SiteSettingsProvider";
import { CatalogProvider } from "@/components/Catalog/CatalogProvider";
import { getPublicCatalog } from "@/lib/pricing/server";
import { todayInZone } from "@/lib/booking/timezone";
import { bookingRules } from "@/config/booking";
import ChalkFilters from "@/components/ChalkFilters/ChalkFilters";
import SeasonalDecor from "@/components/SeasonalDecor/SeasonalDecor";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import MetaPixel from "@/components/layout/MetaPixel";
import VercelInsights from "@/components/layout/VercelInsights";
import { LANDING_PATH } from "@/config/landing";
import { siteMetadata } from "@/lib/seo/metadata";
import "@/styles/globals.css";
import { cn } from "@/lib/cn";

const schoolbell = localFont({ src: "./fonts/schoolbell-400.woff2", variable: "--font-schoolbell", display: "swap", weight: "400" });
const patrick = localFont({ src: "./fonts/patrick-hand-400.woff2", variable: "--font-patrick", display: "swap", weight: "400" });

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#183a22",
};

/** Pages families open straight from an email or from Stripe: they see their page at once, never the intro. */
const NO_INTRO_PATHS = ["/review", "/pay", "/cancel", "/reschedule", "/backdrop"];

/**
 * Runs before first paint: decides whether the chalk intro plays.
 * Skipped in the owner area and on NO_INTRO_PATHS. On the ad landing page it's skipped too (paid visitors see content
 * at once); preview the alternatives with ?intro=short (logo slides in, ~0.6 s) or ?intro=full. Without JavaScript the
 * site simply shows.
 */
const introScript = `(function(){try{var p=location.pathname;if(p.indexOf('/admin')===0)return;var n=${JSON.stringify(NO_INTRO_PATHS)};for(var k=0;k<n.length;k++){if(p===n[k]||p.indexOf(n[k]+'/')===0)return;}var d=document.documentElement;var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var i=new URLSearchParams(location.search).get('intro');if(p.indexOf('${LANDING_PATH}')===0&&i!=='full'){if(i==='short')d.setAttribute('data-intro','reduced');return;}d.setAttribute('data-intro',r?'reduced':'play');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The owner's live theme + photos (falls back to the defaults).
  const settings = await getSiteSettings();
  const catalog = await getPublicCatalog();
  const theme = getTheme(settings.themeId);
  return (
    <html
      lang="en"
      data-theme={theme.id}
      data-scroll-behavior="smooth"
      style={themeCssVariables(theme) as React.CSSProperties}
      className={cn(schoolbell.variable, patrick.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
        {Object.values(theme.logo.layers).map((src) => (
          <link key={src} rel="preload" as="image" href={src} />
        ))}
      </head>
      <body>
        <ChalkFilters />
        <SiteSettingsProvider initial={settings}>
        <CatalogProvider initial={catalog.bundles} status={catalog.status} initialToday={todayInZone(bookingRules.timeZone)}>
          <SeasonalDecor />
          {/* Header lives in the layout so the logo intro never replays between pages. */}
          <Header />
          {children}
          <Footer />
          <MetaPixel />
        </CatalogProvider>
        </SiteSettingsProvider>
        {/* only on Vercel: its /_vercel/* script routes don't exist locally */}
        {process.env.VERCEL ? <VercelInsights /> : null}
      </body>
    </html>
  );
}
