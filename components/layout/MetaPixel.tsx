"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/tracking/client";

/**
 * Meta Pixel (site pages only, never /admin). Loads only when NEXT_PUBLIC_META_PIXEL_ID is set.
 * PageView: fired by the base code on the first load, then here on each client-side navigation. The Pixel's own
 * history tracking is switched off (disablePushState) so a navigation is never counted twice, and automatic event
 * setup is off (autoConfig) so nothing is collected from the page beyond the events we send.
 */
export default function MetaPixel() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();
  const first = useRef(true);
  const onAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (!id || onAdmin) return;
    if (first.current) {
      first.current = false;
      return;
    }
    trackPageView();
  }, [id, onAdmin, pathname]);

  if (!id || onAdmin || !/^\d+$/.test(id)) return null;
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
