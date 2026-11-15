import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/features/booking/flow/ScheduleBooking";
import { BookingSelectionProvider } from "@/features/booking/flow/BookingSelectionContext";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.bookingRequest.meta.title, description: es.bookingRequest.meta.description, path: "/book", locale: "es", index: false });

/** /book (brief 02): when → your details → request sent; also the owner's pay links and due-date schedule links. */
export default async function BookPageEs() {
  const [travel, noticeHours] = await Promise.all([getTravelSettings(), getNoticeHoursSetting()]);
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}>
          <ScheduleBooking
            locale="es"
            messages={es.bookingFlow}
            inspiration={es.bundlesPage.inspiration}
            freeMiles={travel?.freeMiles ?? null}
            noticeHours={noticeHours}
            request={{ request: es.bookingRequest, calendar: es.bookingFlow.calendar, time: es.bookingFlow.time, travel: es.bookingFlow.details.travel, paused: es.bundlesPage.paused, due: es.bookingFlow.due }}
          />
        </Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
