import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = { title: "Leads · Owner area", robots: { index: false, follow: false } };

/** Owner area: Leads. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="leads" />
    </main>
  );
}
