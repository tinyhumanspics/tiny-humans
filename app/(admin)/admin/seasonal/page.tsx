import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = { title: "Seasonal Landing · Owner area", robots: { index: false, follow: false } };

/** Owner area: seasonal landing offers and their real cutoff dates. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="seasonal" />
    </main>
  );
}
