import type { Metadata } from "next";
import { Suspense } from "react";
import ReschedulePage from "@/components/Reschedule/ReschedulePage";
import en from "@/messages/en.json";

export const metadata: Metadata = {
  title: en.reschedulePage.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Customer reschedule page, opened from the confirmation email (/reschedule?t=<token>). */
export default function Page() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <ReschedulePage locale="en" messages={en.reschedulePage} bookingMessages={en.bookingFlow} policyMessages={en.policy} />
      </Suspense>
    </main>
  );
}
