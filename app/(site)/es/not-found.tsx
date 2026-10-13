import type { Metadata } from "next";
import NotFound from "@/components/NotFound/NotFound";
import { bundlesHref } from "@/config/booking";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { getSpanishPublication } from "@/i18n/publication";

export async function generateMetadata(): Promise<Metadata> {
  const messages = (await getSpanishPublication()).published ? es : en;
  return { title: messages.errors.notFound.metaTitle, robots: { index: false, follow: false } };
}

export default async function SpanishNotFound() {
  const published = (await getSpanishPublication()).published;
  const locale = published ? "es" : "en";
  return <NotFound messages={(published ? es : en).errors.notFound} homeHref={published ? "/es" : "/"} bundlesHref={bundlesHref(null, locale)} />;
}
