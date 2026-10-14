import type { Metadata } from "next";
import { Suspense } from "react";
import Bundles from "@/features/booking/bundles/Bundles";
import InspirationBanner from "@/features/booking/flow/InspirationBanner";
import InspirationFromUrl from "@/features/booking/flow/InspirationFromUrl";
import { BookingSelectionProvider } from "@/features/booking/flow/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.bundlesPage.meta.title, description: es.bundlesPage.meta.description, path: "/bundles", locale: "es", translations: true });

export default function BundlesPage() {
  return (
    <BookingSelectionProvider>
      <Suspense fallback={null}><InspirationFromUrl /></Suspense>
      <main id="top" className="book-page">
        <InspirationBanner messages={es.bundlesPage.inspiration} />
        <Bundles messages={es.bundlesPage} locale="es" />
      </main>
    </BookingSelectionProvider>
  );
}
