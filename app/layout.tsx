import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getTheme, themeCssVariables } from "@/config/themes";
import { getSiteSettings } from "@/lib/settings/server";
import ChalkFilters from "@/components/chalk/ChalkFilters/ChalkFilters";
import VercelInsights from "@/components/layout/VercelInsights";
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

/** Set in the visitor's browser once the chalk intro has played. */
const INTRO_SEEN_KEY = "th-intro-seen";

/**
 * Runs before first paint: decides whether the chalk intro plays. Only on the home page (/ and /es), at most once per
 * visitor (brief 05); every other page, and home after that first time, shows at once. Reduced motion gets the short
 * version. Without JavaScript or browser storage the site simply shows.
 */
const introScript = `(function(){try{var p=location.pathname;if(p!=='/'&&p!=='/es')return;var s=window.localStorage;if(s.getItem('${INTRO_SEEN_KEY}'))return;s.setItem('${INTRO_SEEN_KEY}','1');var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;document.documentElement.setAttribute('data-intro',r?'reduced':'play');}catch(e){}})();`;

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
