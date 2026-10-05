import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getTheme, themeCssVariables } from "@/config/themes";
import { site } from "@/config/site";
import { getSiteSettings } from "@/lib/settings/server";
import { SiteSettingsProvider } from "@/components/SiteSettings/SiteSettingsProvider";
import ChalkFilters from "@/components/ChalkFilters/ChalkFilters";
import SeasonalDecor from "@/components/SeasonalDecor/SeasonalDecor";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import "@/styles/globals.css";

const schoolbell = localFont({ src: "./fonts/schoolbell-400.woff2", variable: "--font-schoolbell", display: "swap", weight: "400" });
const patrick = localFont({ src: "./fonts/patrick-hand-400.woff2", variable: "--font-patrick", display: "swap", weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Newborn & Baby Photography`, template: `%s | ${site.name}` },
  description: site.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#183a22",
};

/**
 * Runs before first paint: decides whether the chalk intro plays.
 * Skipped in the owner area. Without JavaScript the site simply shows.
 */
const introScript = `(function(){try{if(location.pathname.indexOf('/admin')===0)return;var d=document.documentElement;var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;d.setAttribute('data-intro',r?'reduced':'play');}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The owner's live theme + photos (falls back to the defaults).
  const settings = await getSiteSettings();
  const theme = getTheme(settings.themeId);
  return (
    <html
      lang="en"
      data-theme={theme.id}
      data-scroll-behavior="smooth"
      style={themeCssVariables(theme) as React.CSSProperties}
      className={`${schoolbell.variable} ${patrick.variable}`}
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
          <SeasonalDecor />
          {/* Header lives in the layout so the logo intro never replays between pages. */}
          <Header />
          {children}
          <Footer />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
