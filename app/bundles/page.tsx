import type { Metadata } from "next";
import { Suspense } from "react";
import { site } from "@/config/site";
import Bundles from "@/components/Bundles/Bundles";
import InspirationBanner from "@/components/Booking/InspirationBanner";
import InspirationFromUrl from "@/components/Booking/InspirationFromUrl";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";

export const metadata: Metadata = {
  title: site.bookPage.title,
  description: site.bookPage.description,
};

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
