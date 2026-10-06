import type { Metadata } from "next";
import { Suspense } from "react";
import CancelBooking from "@/components/Cancel/CancelBooking";

export const metadata: Metadata = {
  title: "Cancel your session",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Customer cancellation page, opened from the confirmation email (/cancel?t=<token>). */
export default function CancelPage() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <CancelBooking />
      </Suspense>
    </main>
  );
}
