import type { AvailabilityQuery, BookingClient, BookingRequest, BookingResult, DayAvailability } from "./types";
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
    const params = new URLSearchParams({ bundle: q.bundleId, from: q.from, to: q.to });
    return call<{ days: DayAvailability[] }>(`/api/booking/availability?${params}`).then((r) => r.days);
  }

  createBooking(request: BookingRequest): Promise<BookingResult> {
    return call<{ booking: BookingResult }>("/api/booking/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }).then((r) => r.booking);
  }
}
