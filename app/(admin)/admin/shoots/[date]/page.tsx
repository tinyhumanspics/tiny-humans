import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminApp from "@/features/admin/AdminApp";

export const metadata: Metadata = { title: "Shoot day sheet · Shoots · Owner area", robots: { index: false, follow: false } };

/** Owner area: the day sheet for a shoot day (`date` = YYYY-MM-DD, Miami). */
export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  return (
    <main id="top" className="container">
      <AdminApp section="shoots" view="day" date={date} />
    </main>
  );
}
