import { notFound } from "next/navigation";
import { getSpanishPublication } from "@/i18n/publication";

/** Spanish is deliberately all-or-nothing: no route is visible until every live publication gate passes. */
export default async function SpanishLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSpanishPublication()).published) notFound();
  return children;
}
