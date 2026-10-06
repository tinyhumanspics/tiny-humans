import "server-only";
import { log } from "@/lib/log";
import { MockBookingProvider } from "./mock-provider";
import { OutlookBookingProvider } from "./outlook-provider";
import { getAvailabilityRules } from "@/lib/availability/server";
import type { BookingProvider } from "./types";

export type ProviderMode = "mock" | "outlook";

/** BOOKING_PROVIDER=mock (default) or BOOKING_PROVIDER=outlook. */
export function providerMode(): ProviderMode {
  const v = (process.env.BOOKING_PROVIDER ?? "mock").trim().toLowerCase();
  if (v !== "mock" && v !== "outlook") log.warn("booking", "Unknown BOOKING_PROVIDER, using mock", { value: v });
  return v === "outlook" ? "outlook" : "mock";
}

let instance: { mode: ProviderMode; provider: BookingProvider } | null = null;

/** Server-side booking provider (used by the API routes and future admin tools). */
export function getBookingProvider(): BookingProvider {
  const mode = providerMode();
  if (!instance || instance.mode !== mode) {
    instance = { mode, provider: mode === "outlook" ? new OutlookBookingProvider() : new MockBookingProvider(getAvailabilityRules) };
  }
  return instance.provider;
}
