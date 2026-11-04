import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/messages/en.json";
import FeedbackForm from "@/features/unfinished/FeedbackForm";

export const metadata: Metadata = { title: en.feedback.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

/** "What stopped you?", opened from the unfinished-booking email (/feedback?t=<token>). */
export default function FeedbackPage() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <FeedbackForm locale="en" messages={en.feedback} />
      </Suspense>
    </main>
  );
}
