import type { Metadata } from "next";
import { Suspense } from "react";
import UnsubscribeForm from "@/features/unfinished/UnsubscribeForm";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.unsubscribe.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function UnsubscribePage() {
  return <main id="top"><Suspense fallback={null}><UnsubscribeForm locale="es" messages={es.unsubscribe} /></Suspense></main>;
}
