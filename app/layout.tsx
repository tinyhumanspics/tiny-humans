import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getTheme, themeCssVariables } from "@/config/themes";
import { getSiteSettings } from "@/lib/settings/server";
import ChalkFilters from "@/components/chalk/ChalkFilters/ChalkFilters";
import VercelInsights from "@/components/layout/VercelInsights";
import { LANDING_PATH } from "@/config/landing";
import { siteMetadata } from "@/lib/seo/metadata";
import { getPublicLocale } from "@/i18n/publication";
import "@/styles/globals.css";
import { cn } from "@/lib/cn";

const schoolbell = localFont({ src: "./fonts/schoolbell-400.woff2", variable: "--font-schoolbell", display: "swap", weight: "400" });
const patrick = localFont({ src: "./fonts/patrick-hand-400.woff2", variable: "--font-patrick", display: "swap", weight: "400" });

export const metadata: Metadata = siteMetadata;

/** The phone browser's top bar matches the active theme's board color. */
export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteSettings();
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: getTheme(settings.themeId).colors.chalkboard };
}

/** Pages families open straight from an email or from Stripe: they see their page at once, never the intro. */
const NO_INTRO_PATHS = ["/review", "/pay", "/cancel", "/reschedule", "/backdrop"];

/**
 * Runs before first paint: decides whether the chalk intro plays.
 * Skipped in the owner area and on NO_INTRO_PATHS. On the ad landing page it's skipped too (paid visitors see content
 * at once); preview the alternatives with ?intro=short (logo slides in, ~0.6 s) or ?intro=full. Without JavaScript the
 * site simply shows.
 */
const introScript = `(function(){try{var p=location.pathname;if(p.indexOf('/admin')===0)return;var q=p==='/es'?'/':(p.indexOf('/es/')===0?p.slice(3):p);var n=${JSON.stringify(NO_INTRO_PATHS)};for(var k=0;k<n.length;k++){if(q===n[k]||q.indexOf(n[k]+'/')===0)return;}var d=document.documentElement;var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var i=new URLSearchParams(location.search).get('intro');if(q.indexOf('${LANDING_PATH}')===0&&i!=='full'){if(i==='short')d.setAttribute('data-intro','reduced');return;}d.setAttribute('data-intro',r?'reduced':'play');}catch(e){}})();`;

/**
 * The one root layout: the document (html/body), fonts, theme colors, intro script and viewport. The site's shell
 * (providers, header, footer: `components/layout/SiteShell`) is drawn by the (site) and (admin) layouts and the 404.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, locale] = await Promise.all([getSiteSettings(), getPublicLocale()]);
  const theme = getTheme(settings.themeId);
  return (
    <html
      lang={locale}
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
        {children}
        {/* only on Vercel: its /_vercel/* script routes don't exist locally */}
        {process.env.VERCEL ? <VercelInsights /> : null}
      </body>
    </html>
  );
}
