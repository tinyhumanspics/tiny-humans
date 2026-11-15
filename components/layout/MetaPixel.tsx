"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackContact, trackPageView } from "@/lib/tracking/client";
import { pixelAllowed } from "@/lib/tracking/safe-url";

/**
 * Meta Pixel (site pages only: never /admin, never pages whose links carry a secret token, see pixelAllowed). Loads
 * only when NEXT_PUBLIC_META_PIXEL_ID is set. Contact: a tap on any "text us" / "call us" link (sms:, tel:).
 * PageView: fired by the base code on the first load, then here on each client-side navigation. The Pixel's own
 * history tracking is switched off (disablePushState) so a navigation is never counted twice, and automatic event
 * setup is off (autoConfig) so nothing is collected from the page beyond the events we send.
 */
export default function MetaPixel() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname() ?? "/";
  const search = useSearchParams()?.toString() ?? "";
  const first = useRef(true);
  const allowed = pixelAllowed(pathname, search);

  useEffect(() => {
    if (!id || !allowed) return;
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView();
  }, [id, allowed, pathname]);

  // taps on sms: / tel: links anywhere on the page (the Request sent screen, "text us" links); a no-op without the Pixel
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="sms:"], a[href^="tel:"]');
      if (link) trackContact();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!id || !allowed || !/^\d+$/.test(id)) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq.disablePushState=true;
fbq('set','autoConfig',false,'${id}');
fbq('init','${id}');
fbq('track','PageView');`}
    </Script>
  );
}
