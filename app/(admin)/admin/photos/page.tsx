import type { Metadata } from "next";
import AdminApp from "@/components/Admin/AdminApp";

export const metadata: Metadata = { title: "Photos / Media · Owner area", robots: { index: false, follow: false } };

/** Owner area: Photos / Media. */
export default function Page() {
  return (
    <main id="top" className="container">
      <AdminApp section="photos" />
    </main>
  );
}
