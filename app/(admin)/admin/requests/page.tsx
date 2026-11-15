import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Requests · Owner area", robots: { index: false, follow: false } };

/** Owner area: booking requests from the website (brief 02): text, confirm with the pay link, other time, decline. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="requests" />
    </main>
  );
}
