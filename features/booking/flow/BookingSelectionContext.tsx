"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface Ctx {
  /** Portfolio photo that inspired this booking, if any. */
  inspirationId: string | null;
  setInspirationId: (id: string | null) => void;
}

const BookingSelectionContext = createContext<Ctx | null>(null);

export function BookingSelectionProvider({ children }: { children: ReactNode }) {
  const [inspirationId, setInspirationId] = useState<string | null>(null);
  const value = useMemo(() => ({ inspirationId, setInspirationId }), [inspirationId]);
  return <BookingSelectionContext.Provider value={value}>{children}</BookingSelectionContext.Provider>;
}

export function useBookingSelection(): Ctx {
  const ctx = useContext(BookingSelectionContext);
  if (!ctx) throw new Error("useBookingSelection must be used inside BookingSelectionProvider");
  return ctx;
}
