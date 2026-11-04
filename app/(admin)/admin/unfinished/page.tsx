import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Unfinished bookings · Owner area", robots: { index: false, follow: false } };

/** Owner area: families who started booking but didn't finish. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="unfinished" />
    </main>
  );
}
