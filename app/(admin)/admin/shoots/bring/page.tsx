import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "What we always bring · Shoots · Owner area", robots: { index: false, follow: false } };

/** Owner area: Shoots → What we always bring. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="shoots" view="bring" />
    </main>
  );
}
