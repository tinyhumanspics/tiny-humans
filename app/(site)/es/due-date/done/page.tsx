import type { Metadata } from "next";
import DueDateDone from "@/features/booking/DueDateDone";
import { bundlesHref } from "@/config/booking";
import { localePath } from "@/i18n/path";
import { dueReturnState } from "@/lib/due-date/server";
import { pageMetadata } from "@/lib/seo/metadata";
import messages from "@/messages/es.json";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({ title: messages.dueDate.meta.title, description: messages.dueDate.meta.description, path: "/due-date/done", locale: "es", index: false });

/** After reserving with the due date, or back from its deposit page (signed link: ?r=<reference>&k=<signature>). */
export default async function DueDateDonePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const result = await dueReturnState(one(q.r), one(q.k)).catch(() => ({ state: "invalid" as const, row: undefined, payUrl: undefined }));
  return (
    <main id="top" className="book-page">
      <DueDateDone
        state={result.state}
        name={result.row?.parentName}
        payUrl={result.payUrl}
        paid={one(q.paid) === "1"}
        againHref={`${localePath("/due-date", "es")}?${result.row ? `bundle=${encodeURIComponent(result.row.packageId)}&` : ""}new=1`}
        bundlesHref={bundlesHref(null, "es")}
        messages={messages.dueDate.done}
        r={one(q.r)}
        k={one(q.k)}
        locale="es"
      />
    </main>
  );
}
