import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = {
  title: "Owner area",
  robots: { index: false, follow: false },
};

/** Owner-only area: theme switching + portfolio photos. Not linked from the site. */
export default function AdminPage() {
  return (
    <main id="top" className="container">
      <AdminApp />
    </main>
  );
}
