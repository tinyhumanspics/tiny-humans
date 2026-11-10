import type { Metadata } from "next";
import WaiverKiosk from "@/features/waiver/WaiverKiosk";

export const metadata: Metadata = { title: "Photo and video release · Tiny Humans", robots: { index: false, follow: false } };

/** Owner area (signed in), handed to the parent: sign the photo and video release for booking `reference`. */
export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <WaiverKiosk reference={decodeURIComponent(reference)} />;
}
