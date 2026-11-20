import type { Metadata } from "next";
import { Suspense } from "react";
import en from "@/messages/en.json";
import ExtrasPage from "@/features/photo-extras/ExtrasPage";

export const metadata: Metadata = {
  title: en.extras.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Photo extras after the session, opened from the sneak-peek email (/extras?b=<reference>&s=<signature>). */
export default function Page() {
  return (
    <main id="top">
      <Suspense fallback={null}>
        <ExtrasPage locale="en" messages={en.extras} />
      </Suspense>
    </main>
  );
}
