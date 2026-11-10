import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Shoots · Owner area", robots: { index: false, follow: false } };

/** Owner area: Shoots → Shoot days (coming up / done). */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="shoots" view="days" />
    </main>
  );
}
