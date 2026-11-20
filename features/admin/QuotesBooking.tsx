"use client";

import type { AdminApi } from "@/lib/admin/client";
import BookingLinkForm from "./BookingLinkForm";
import QuotesPanel from "./QuotesPanel";

/** /admin → Quotes / Booking: the price for a ZIP code, and "Send a booking link" for families who reach you directly. */
export default function QuotesBooking({ api }: { api: AdminApi }) {
  return (
    <>
      <QuotesPanel api={api} />
      <BookingLinkForm api={api} />
    </>
  );
}
