import type { Metadata } from "next";
import { Suspense } from "react";
import RequestFlow from "@/features/booking/request/RequestFlow";
import { getNoticeHoursSetting } from "@/lib/availability/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { getTravelSettings } from "@/lib/travel/server";
import es from "@/messages/es.json";

export const metadata: Metadata = pageMetadata({ title: es.bookingRequest.meta.title, description: es.bookingRequest.meta.description, path: "/book/new", locale: "es", index: false });

/** The new /book (brief 02), at its own address until it replaces /book: when → your details → request sent. */
export default async function BookRequestPageEs() {
  const [travel, noticeHours] = await Promise.all([getTravelSettings(), getNoticeHoursSetting()]);
  return (
    <main id="top" className="book-page">
      <Suspense fallback={null}>
        <RequestFlow
          locale="es"
          freeMiles={travel?.freeMiles ?? null}
          noticeHours={noticeHours}
          messages={{ request: es.bookingRequest, calendar: es.bookingFlow.calendar, time: es.bookingFlow.time, travel: es.bookingFlow.details.travel, paused: es.bundlesPage.paused }}
        />
      </Suspense>
    </main>
  );
}
