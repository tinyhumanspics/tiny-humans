import type { Metadata } from "next";
import SignedWaiverView from "@/features/waiver/SignedWaiverView";

export const metadata: Metadata = { title: "Signed waiver · Owner area", robots: { index: false, follow: false } };

/** Owner area: a signed photo and video release, read-only and printable. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SignedWaiverView id={id} />;
}
