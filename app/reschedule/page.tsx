import type { Metadata } from "next";
import { Suspense } from "react";
import ReschedulePage from "@/components/Reschedule/ReschedulePage";

export const metadata: Metadata = {
  title: "Reschedule your session",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Customer reschedule page, opened from the confirmation email (/reschedule?t=<token>). */
export default function Page() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <ReschedulePage />
      </Suspense>
    </main>
  );
}
