import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = { title: "Settings · Owner area", robots: { index: false, follow: false } };

/** Owner area: Settings. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="settings" />
    </main>
  );
}
