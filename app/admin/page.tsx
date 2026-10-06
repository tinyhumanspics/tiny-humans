import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = {
  title: "Owner area",
  robots: { index: false, follow: false },
};

/** Owner area dashboard (navigation to every section). Not linked from the site. */
export default function AdminPage() {
  return (
    <main id="top" className="container">
      <AdminApp section="dashboard" />
    </main>
  );
}
