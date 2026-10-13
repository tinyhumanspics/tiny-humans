import type { Metadata } from "next";
import { PayStatus, PAY_STATES, type PayState } from "@/features/after-session";
import es from "@/messages/es.json";

export const metadata: Metadata = { title: es.pay.metaTitle, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PayStatusPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const state: PayState = (PAY_STATES as readonly string[]).includes(s ?? "") ? (s as PayState) : "invalid";
  return <main id="top"><PayStatus state={state} locale="es" messages={es.pay} /></main>;
}
