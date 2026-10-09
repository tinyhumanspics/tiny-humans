import type { Metadata } from "next";
import { Suspense } from "react";
import CancelBooking from "@/components/Cancel/CancelBooking";
import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: en.cancelPage.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Customer cancellation page, opened from the confirmation email (/cancel?t=<token>). */
export default function CancelPage() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <CancelBooking locale="en" messages={en.cancelPage} policyMessages={en.policy} />
      </Suspense>
    </main>
  );
}
