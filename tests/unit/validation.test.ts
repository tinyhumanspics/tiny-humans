import { describe, expect, test } from "vitest";
import { overrideSchema } from "@/lib/availability/validation";
import { availabilityQuerySchema, bookingRequestSchema } from "@/lib/booking/validation";
import { bundleInputSchema, codeInputSchema } from "@/lib/pricing/validation";
import { daysBetweenDateKeys, isDateKey } from "@/lib/validation/date-key";

describe("calendar date validation", () => {
  test("accepts real dates and leap days", () => {
    expect(isDateKey("2026-10-10")).toBe(true);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(daysBetweenDateKeys("2026-10-10", "2026-10-12")).toBe(2);
  });

  test("rejects impossible or malformed dates", () => {
    for (const value of ["2025-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-10-00", "0000-01-01", "10/10/2026"]) {
      expect(isDateKey(value), value).toBe(false);
    }
    expect(daysBetweenDateKeys("2026-02-30", "2026-03-01")).toBeNull();
  });

  test("rejects impossible dates across booking, availability and pricing inputs", () => {
    expect(availabilityQuerySchema.safeParse({ bundleId: "little-moments", from: "2026-02-30", to: "2026-03-02" }).success).toBe(false);
    expect(overrideSchema.safeParse({ date: "2026-04-31", isClosed: true }).success).toBe(false);

    const booking = {
      bundleId: "little-moments",
      slot: { date: "2026-02-30", start: "10:00" },
      contact: { parentName: "Test Parent", email: "test@example.com", phone: "3055550100", babyAge: "Newborn (0–2 weeks)" },
      address: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139" },
    };
    expect(bookingRequestSchema.safeParse(booking).success).toBe(false);

    const bundle = {
      name: "Test Bundle",
      price: 149,
      durationMinutes: 60,
      features: [],
      active: true,
      offer: { enabled: true, price: 129, endsOn: "2026-02-30" },
      extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
    };
    expect(bundleInputSchema.safeParse(bundle).success).toBe(false);
    expect(
      codeInputSchema.safeParse({
        code: "TEST10",
        type: "fixed",
        value: 10,
        bundleIds: ["little-moments"],
        active: true,
        expiresOn: "2026-04-31",
        onePerEmail: true,
      }).success,
    ).toBe(false);
  });

  test("limits availability ranges to 62 actual days", () => {
    expect(availabilityQuerySchema.safeParse({ bundleId: "little-moments", from: "2026-10-01", to: "2026-12-02" }).success).toBe(true);
    expect(availabilityQuerySchema.safeParse({ bundleId: "little-moments", from: "2026-10-01", to: "2026-12-03" }).success).toBe(false);
  });
});
