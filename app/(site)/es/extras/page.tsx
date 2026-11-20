import type { Metadata } from "next";
import { Suspense } from "react";
import ExtrasPage from "@/features/photo-extras/ExtrasPage";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.extras.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return <main id="top"><Suspense fallback={null}><ExtrasPage locale="es" messages={es.extras} /></Suspense></main>;
}
