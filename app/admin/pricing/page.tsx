import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = { title: "Pricing & Promotions · Owner area", robots: { index: false, follow: false } };

/** Owner area: bundles, prices, special offers, discount codes. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="pricing" />
    </main>
  );
}
