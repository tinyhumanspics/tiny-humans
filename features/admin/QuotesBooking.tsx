"use client";

import type { AdminApi } from "@/lib/admin/client";
import OwnerBookingForm from "./OwnerBookingForm";
import QuotesPanel from "./QuotesPanel";

/** /admin → Quotes / Booking: the price for a ZIP code, and "Book it for them" for families who reach you directly. */
export default function QuotesBooking({ api }: { api: AdminApi }) {
  return (
    <>
      <QuotesPanel api={api} />
      <OwnerBookingForm api={api} />
    </>
  );
}
