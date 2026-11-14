import type { Metadata } from "next";
import { Suspense } from "react";
import Quick from "@/features/booking/Quick";
import { pageMetadata } from "@/lib/seo/metadata";
import messages from "@/messages/en.json";

export const metadata: Metadata = pageMetadata({ title: messages.quick.meta.title, description: messages.quick.meta.description, path: "/quick", index: false });

/** The quick form: a family sends a few details and the studio books the session for them. */
export default function QuickPage() {
  return (
    <main id="top" className="book-page">
      <Suspense fallback={null}>
        <Quick locale="en" messages={messages.quick} bookingMessages={messages.bookingFlow} />
      </Suspense>
    </main>
  );
}
