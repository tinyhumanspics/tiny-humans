import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/components/Booking/ScheduleBooking";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Pick your date",
  description: "Choose a day and time, and we'll bring the studio to your home.",
  path: "/book",
  index: false,
});

/** Booking, step two (/book): calendar for the bundle in ?bundle=<id>. Without one, it points to /bundles. */
export default function BookPage() {
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}>
          <ScheduleBooking locale="en" />
        </Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
