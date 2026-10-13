import type { Metadata } from "next";
import en from "@/messages/en.json";
import { PayStatus, PAY_STATES, type PayState } from "@/features/after-session";

export const metadata: Metadata = {
  title: en.pay.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** /pay/status?s=paid|already|nothing|cancelled|invalid|error */
export default async function PayStatusPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const state: PayState = (PAY_STATES as readonly string[]).includes(s ?? "") ? (s as PayState) : "invalid";
  return (
    <main id="top">
      <PayStatus state={state} locale="en" messages={en.pay} />
    </main>
  );
}
