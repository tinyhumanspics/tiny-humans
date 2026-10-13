import type { BookingClient } from "./types";
import { HttpBookingClient } from "./http-client";

let client: BookingClient | null = null;

/**
 * The booking form's single entry point: the /api/booking routes, where the server chooses the provider from
 * BOOKING_PROVIDER (mock or outlook).
 */
export function getBookingClient(): BookingClient {
  if (!client) client = new HttpBookingClient();
  return client;
}

export * from "./types";
export * from "./dates";
export { BookingApiError } from "./http-client";
