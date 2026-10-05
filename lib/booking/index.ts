import type { BookingClient } from "./types";
import { MockBookingProvider } from "./mock-provider";
import { HttpBookingClient } from "./http-client";

let client: BookingClient | null = null;

/**
 * The booking form's single entry point.
 * - Static prototype (NEXT_PUBLIC_PROTOTYPE=1): in-browser mock, no server.
 * - Real site: the /api/booking routes, where the server chooses the
 *   provider from BOOKING_PROVIDER (mock or outlook).
 */
export function getBookingClient(): BookingClient {
  if (!client) client = process.env.NEXT_PUBLIC_PROTOTYPE === "1" ? new MockBookingProvider() : new HttpBookingClient();
  return client;
}

export * from "./types";
export * from "./dates";
export { BookingApiError } from "./http-client";
