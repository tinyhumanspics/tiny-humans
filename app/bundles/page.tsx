import type { Metadata } from "next";
import { Suspense } from "react";
import { site } from "@/config/site";
import Bundles from "@/components/Bundles/Bundles";
import InspirationBanner from "@/components/Booking/InspirationBanner";
import InspirationFromUrl from "@/components/Booking/InspirationFromUrl";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: site.bookPage.title,
  description: site.bookPage.description,
  path: "/bundles",
});

/** Booking, step one (/bundles): pick a bundle. Each bundle leads to the calendar at /book?bundle=<id>. */
export default function BundlesPage() {
  return (
    <BookingSelectionProvider>
      {/* Reads ?inspiration=<photo id> from "Book a memory like this one" links */}
      <Suspense fallback={null}>
        <InspirationFromUrl />
      </Suspense>
      <main id="top" className="book-page">
        <InspirationBanner />
        <Bundles />
      </main>
    </BookingSelectionProvider>
  );
}
