import type { Metadata } from "next";
import { Suspense } from "react";
import CancelBooking from "@/components/Cancel/CancelBooking";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.cancelPage.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function CancelPage() {
  return <main id="top"><Suspense fallback={null}><CancelBooking locale="es" messages={es.cancelPage} policyMessages={es.policy} /></Suspense></main>;
}
