import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/features/booking/flow/ScheduleBooking";
import { BookingSelectionProvider } from "@/features/booking/flow/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.bookingFlow.meta.title, description: es.bookingFlow.meta.description, path: "/book", locale: "es", index: false });

export default function BookPage() {
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}><ScheduleBooking locale="es" messages={es.bookingFlow} pausedMessages={es.bundlesPage.paused} /></Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
