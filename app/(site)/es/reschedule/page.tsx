import type { Metadata } from "next";
import { Suspense } from "react";
import ReschedulePage from "@/components/Reschedule/ReschedulePage";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.reschedulePage.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return <main id="top"><Suspense fallback={null}><ReschedulePage locale="es" messages={es.reschedulePage} bookingMessages={es.bookingFlow} policyMessages={es.policy} /></Suspense></main>;
}
