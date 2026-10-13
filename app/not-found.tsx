import type { Metadata } from "next";
import en from "@/messages/en.json";
import { bundlesHref } from "@/config/booking";
import SiteShell from "@/components/layout/SiteShell";
import NotFound from "@/components/NotFound/NotFound";

const t = en.errors.notFound;

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

/**
 * 404 for unknown addresses (Next adds `noindex` automatically). It renders inside the root layout only, outside the
 * (site) layout, so it draws the site shell (header + footer) itself. `notFound()` inside the site uses
 * `app/(site)/not-found.tsx` instead (already inside the shell).
 */
export default function RootNotFound() {
  return (
    <SiteShell>
      <NotFound messages={t} homeHref="/" bundlesHref={bundlesHref()} />
    </SiteShell>
  );
}
