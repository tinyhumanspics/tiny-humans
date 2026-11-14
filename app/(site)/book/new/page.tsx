import type { Metadata } from "next";
import { Suspense } from "react";
import RequestFlow from "@/features/booking/request/RequestFlow";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import en from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({ title: en.bookingRequest.meta.title, description: en.bookingRequest.meta.description, path: "/book/new", index: false });

/** The new /book (brief 02), at its own address until it replaces /book: when → your details → request sent. */
export default async function BookRequestPage() {
  const [travel, noticeHours] = await Promise.all([getTravelSettings(), getNoticeHoursSetting()]);
  return (
    <main id="top" className="book-page">
      <Suspense fallback={null}>
        <RequestFlow
          locale="en"
          freeMiles={travel?.freeMiles ?? null}
          noticeHours={noticeHours}
          messages={{ request: en.bookingRequest, calendar: en.bookingFlow.calendar, time: en.bookingFlow.time, travel: en.bookingFlow.details.travel, paused: en.bundlesPage.paused }}
        />
      </Suspense>
    </main>
  );
}
