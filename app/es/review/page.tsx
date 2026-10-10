import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewForm } from "@/features/after-session";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.review.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ReviewPage() {
  return <main id="top"><Suspense fallback={null}><ReviewForm locale="es" messages={es.review} /></Suspense></main>;
}
