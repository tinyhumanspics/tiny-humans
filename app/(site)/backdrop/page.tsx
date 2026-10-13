import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/messages/en.json";
import BackdropPage from "@/components/Backdrops/BackdropPage";

export const metadata: Metadata = {
  title: en.backdropPage.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Pick or change the session's backdrop, opened from the confirmation or reminder email (/backdrop?t=<token>). */
export default function Page() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <BackdropPage locale="en" messages={en.backdropPage} bookingMessages={en.bookingFlow} />
      </Suspense>
    </main>
  );
}
