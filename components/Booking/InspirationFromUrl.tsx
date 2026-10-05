"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { findPhoto, useSiteSettings } from "@/components/SiteSettings/SiteSettingsProvider";
import { useBookingSelection } from "./BookingSelectionContext";

/** Picks up ?inspiration=<photo id> from "Book a memory like this one" links. */
export default function InspirationFromUrl() {
  const params = useSearchParams();
  const { setInspirationId } = useBookingSelection();
  const id = params.get("inspiration");
  const { photos } = useSiteSettings();

  useEffect(() => {
    if (id && findPhoto(photos, id)) setInspirationId(id);
  }, [id, photos, setInspirationId]);

  return null;
}
