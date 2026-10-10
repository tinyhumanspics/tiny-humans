import type { Metadata } from "next";
import { Suspense } from "react";
import Bundles from "@/components/Bundles/Bundles";
import InspirationBanner from "@/components/Booking/InspirationBanner";
import InspirationFromUrl from "@/components/Booking/InspirationFromUrl";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";
import { getSpanishPublication } from "@/i18n/publication";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: en.bundlesPage.meta.title,
    description: en.bundlesPage.meta.description,
    path: "/bundles",
    translations: (await getSpanishPublication()).published,
  });
}

/** Booking, step one (/bundles): pick a bundle. Each bundle leads to the calendar at /book?bundle=<id>. */
export default function BundlesPage() {
  return (
    <BookingSelectionProvider>
      {/* Reads ?inspiration=<photo id> from "Book a memory like this one" links */}
      <Suspense fallback={null}>
        <InspirationFromUrl />
      </Suspense>
      <main id="top" className="book-page">
        <InspirationBanner messages={en.bundlesPage.inspiration} />
        <Bundles messages={en.bundlesPage} locale="en" />
      </main>
    </BookingSelectionProvider>
  );
}
