import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/messages/en.json";
import UnsubscribeForm from "@/features/unfinished/UnsubscribeForm";

export const metadata: Metadata = { title: en.unsubscribe.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Unsubscribe from marketing emails (/unsubscribe?t=<token>, linked at the bottom of each one). */
export default function UnsubscribePage() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <UnsubscribeForm locale="en" messages={en.unsubscribe} />
      </Suspense>
    </main>
  );
}
