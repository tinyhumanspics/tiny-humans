import type { Metadata } from "next";
import { Suspense } from "react";
import BackdropPage from "@/components/Backdrops/BackdropPage";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.backdropPage.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return <main id="top"><Suspense fallback={null}><BackdropPage locale="es" messages={es.backdropPage} bookingMessages={es.bookingFlow} /></Suspense></main>;
}
