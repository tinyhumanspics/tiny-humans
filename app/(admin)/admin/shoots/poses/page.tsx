import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Signature poses · Shoots · Owner area", robots: { index: false, follow: false } };

/** Owner area: Shoots → Signature poses. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="shoots" view="poses" />
    </main>
  );
}
