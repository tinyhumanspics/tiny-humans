import type { Metadata } from "next";
import { Suspense } from "react";
import DueDate from "@/features/booking/DueDate";
import { pageMetadata } from "@/lib/seo/metadata";
import messages from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({ title: messages.dueDate.meta.title, description: messages.dueDate.meta.description, path: "/due-date", index: false });

/** "Not born yet?": reserve a bundle with the due date (no session time yet). */
export default function DueDatePage() {
  return (
    <main id="top" className="book-page">
      <Suspense fallback={null}>
        <DueDate locale="en" messages={messages.dueDate} bookingMessages={messages.bookingFlow} pausedMessages={messages.bundlesPage.paused} />
      </Suspense>
    </main>
  );
}
