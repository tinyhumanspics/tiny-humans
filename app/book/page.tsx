import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/components/Booking/ScheduleBooking";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({
  title: en.bookingFlow.meta.title,
  description: en.bookingFlow.meta.description,
  path: "/book",
  index: false,
});

/** Booking, step two (/book): calendar for the bundle in ?bundle=<id>. Without one, it points to /bundles. */
export default function BookPage() {
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}>
          <ScheduleBooking locale="en" messages={en.bookingFlow} pausedMessages={en.bundlesPage.paused} />
        </Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
