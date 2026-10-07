import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/messages/en.json";
import { ReviewForm } from "@/features/after-session";

export const metadata: Metadata = {
  title: en.review.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Review form, opened from the gallery email (/review?t=<token>). */
export default function ReviewPage() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <ReviewForm />
      </Suspense>
    </main>
  );
}
