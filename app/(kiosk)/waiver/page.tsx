import type { Metadata } from "next";
import WaiverCopyPage, { WaiverCopyInvalid } from "@/features/waiver/WaiverCopyPage";
import { log } from "@/lib/log";
import { verifyWaiverCopy } from "@/lib/payments/link";
import { getSignedWaiver } from "@/lib/waiver/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your signed photo release · Tiny Humans", robots: { index: false, follow: false } };

type Search = Promise<{ w?: string | string[]; s?: string | string[] }>;

/** The parent's own signed copy (linked from the copy we email when they sign). No site menu, no tracking. */
export default async function Page({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const id = typeof q.w === "string" ? q.w : "";
  const sig = typeof q.s === "string" ? q.s : "";
  if (!verifyWaiverCopy(id, sig)) return <WaiverCopyInvalid />;
  const waiver = await getSignedWaiver(id).catch((err) => {
    log.error("waiver.copy", "Signed copy page not loaded", { error: err as Error });
    return null;
  });
  return waiver ? <WaiverCopyPage waiver={waiver} /> : <WaiverCopyInvalid />;
}
