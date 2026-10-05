import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/components/Booking/ScheduleBooking";
import { BookingSelectionProvider } from "@/components/Booking/BookingSelectionContext";

export const metadata: Metadata = {
  title: "Pick your date",
  description: "Choose a day and time, and we'll bring the studio to your home.",
};

/** Booking, step two: calendar for the bundle in ?bundle=<id>. */
export default function SchedulePage() {
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}>
          <ScheduleBooking />
        </Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
