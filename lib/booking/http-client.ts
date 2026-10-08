import type { AvailabilityQuery, BookingClient, BookingRequest, BookingResult, CancellationSummary, DayAvailability, ManagedBooking, PriceQuote } from "./types";
import type { BookingErrorCode } from "./errors";

/** Error from the booking API; `message` is already friendly and safe to show. */
export class BookingApiError extends Error {
  readonly code: BookingErrorCode | "network";
  constructor(code: BookingErrorCode | "network", message: string) {
    super(message);
    this.name = "BookingApiError";
    this.code = code;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new BookingApiError("network", "We couldn't connect. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data as { error?: string; code?: BookingErrorCode };
    throw new BookingApiError(e.code ?? "server_error", e.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

/** Browser side of the booking system: talks to /api/booking/* (the server picks the provider). */
export class HttpBookingClient implements BookingClient {
  readonly name = "http";

  getAvailability(q: AvailabilityQuery): Promise<DayAvailability[]> {
    const params = new URLSearchParams({ bundle: q.bundleId, babies: String(q.babyCount ?? 1), from: q.from, to: q.to });
    return call<{ days: DayAvailability[] }>(`/api/booking/availability?${params}`).then((r) => r.days);
  }

  createBooking(request: BookingRequest): Promise<BookingResult> {
    return call<{ booking: BookingResult }>("/api/booking/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }).then((r) => r.booking);
  }

  quote(bundleId: string, code?: string, email?: string, babyCount = 1): Promise<PriceQuote> {
    return call<{ quote: PriceQuote }>("/api/booking/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bundleId, code, email, babyCount }) }).then((r) => r.quote);
  }

  getCancellation(token: string): Promise<CancellationSummary> {
    return call<{ booking: CancellationSummary }>(`/api/booking/cancel?token=${encodeURIComponent(token)}`).then((r) => r.booking);
  }

  getManagedBooking(token: string): Promise<ManagedBooking> {
    return call<{ booking: ManagedBooking }>(`/api/booking/manage?token=${encodeURIComponent(token)}`).then((r) => r.booking);
  }

  getRescheduleAvailability(token: string, from: string, to: string): Promise<DayAvailability[]> {
    const q = new URLSearchParams({ token, from, to });
    return call<{ days: DayAvailability[] }>(`/api/booking/manage/availability?${q}`).then((r) => r.days);
  }

  rescheduleWithToken(token: string, slot: { date: string; start: string }): Promise<ManagedBooking> {
    return call<{ booking: ManagedBooking }>("/api/booking/manage/reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, date: slot.date, start: slot.start }),
    }).then((r) => r.booking);
  }

  cancelWithToken(token: string, reason: string): Promise<CancellationSummary> {
    return call<{ booking: CancellationSummary }>("/api/booking/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, reason }),
    }).then((r) => r.booking);
  }
}
