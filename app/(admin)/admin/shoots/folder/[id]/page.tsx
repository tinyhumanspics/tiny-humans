import type { Metadata } from "next";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Shoot folder · Shoots · Owner area", robots: { index: false, follow: false } };

/** Owner area: a shoot's folder. `id` = "b-<booking reference>" or the shoot's id (checked by the API). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main id="top" className="container">
      <AdminApp section="shoots" view="folder" shootKey={id} />
    </main>
  );
}
