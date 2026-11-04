import type { Metadata } from "next";
import { Suspense } from "react";
import FeedbackForm from "@/features/unfinished/FeedbackForm";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.feedback.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function FeedbackPage() {
  return <main id="top"><Suspense fallback={null}><FeedbackForm locale="es" messages={es.feedback} /></Suspense></main>;
}
