import type { Metadata } from "next";
import { Suspense } from "react";
import ScheduleBooking from "@/features/booking/flow/ScheduleBooking";
import { BookingSelectionProvider } from "@/features/booking/flow/BookingSelectionContext";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({ title: en.bookingRequest.meta.title, description: en.bookingRequest.meta.description, path: "/book", index: false });

/** /book (brief 02): when → your details → request sent; also the owner's pay links and due-date schedule links. */
export default async function BookPage() {
  const [travel, noticeHours] = await Promise.all([getTravelSettings(), getNoticeHoursSetting()]);
  return (
    <BookingSelectionProvider>
      <main id="top" className="book-page">
        <Suspense fallback={null}>
          <ScheduleBooking
            locale="en"
            messages={en.bookingFlow}
            inspiration={en.bundlesPage.inspiration}
            freeMiles={travel?.freeMiles ?? null}
            noticeHours={noticeHours}
            request={{ request: en.bookingRequest, calendar: en.bookingFlow.calendar, time: en.bookingFlow.time, travel: en.bookingFlow.details.travel, paused: en.bundlesPage.paused, due: en.bookingFlow.due }}
          />
        </Suspense>
      </main>
    </BookingSelectionProvider>
  );
}
