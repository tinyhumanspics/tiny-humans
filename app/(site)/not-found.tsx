import type { Metadata } from "next";
import en from "@/messages/en.json";
import { bundlesHref } from "@/config/booking";
import NotFound from "@/components/layout/NotFound/NotFound";

const t = en.errors.notFound;

export const metadata: Metadata = { title: t.metaTitle, robots: { index: false, follow: false } };

/** 404 for `notFound()` inside the site (e.g. the /es gate while Spanish is hidden); the (site) layout draws the shell. */
export default function SiteNotFound() {
  return <NotFound messages={t} homeHref="/" bundlesHref={bundlesHref()} />;
}
