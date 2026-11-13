import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Quotes / Booking · Owner area", robots: { index: false, follow: false } };

/** Owner area: every bundle's price for a family's ZIP code or address, ready to send. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="quotes" />
    </main>
  );
}
