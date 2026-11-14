"use client";

import { useState } from "react";
import type { AdminApi } from "@/lib/admin/client";
import OwnerBookingForm, { type OwnerPrefill } from "./OwnerBookingForm";
import QuickRequests from "./QuickRequests";
import QuotesPanel from "./QuotesPanel";

/** /admin → Quotes / Booking: the quick form's requests, the price for a ZIP code, and "Book it for them". */
export default function QuotesBooking({ api }: { api: AdminApi }) {
  const [prefill, setPrefill] = useState<OwnerPrefill | null>(null);
  const [reload, setReload] = useState(0);
  return (
    <>
      <QuickRequests
        api={api}
        reload={reload}
        onBook={(p) => {
          setPrefill(p);
          requestAnimationFrame(() => document.getElementById("owner-book-title")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }}
      />
      <QuotesPanel api={api} />
      <OwnerBookingForm
        key={prefill?.requestId ?? "blank"}
        api={api}
        prefill={prefill ?? undefined}
        onClearPrefill={() => setPrefill(null)}
        onBooked={(id, reference) => {
          api
            .setQuickStatus(id, "booked", reference)
            .catch(() => undefined)
            .finally(() => setReload((n) => n + 1));
        }}
      />
    </>
  );
}
