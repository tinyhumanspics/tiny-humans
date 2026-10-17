import { describe, expect, test } from "vitest";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { babiesLabel } from "@/lib/booking/extra-babies";
import { bookingBabiesLabel } from "@/lib/booking/customer-page-format";
import { customerBabiesLabel } from "@/lib/email/customer-format";
import { sanitizeLogFields } from "@/lib/security/logging";
import { initialState, isLanguageDraftPayload } from "@/features/booking/flow/booking-state";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const request = (babies: unknown[]) => ({
  bundleId: "little-moments",
  babies,
  slot: { date: "2026-11-10", start: "10:00" },
  contact: { parentName: "Test Parent", email: "test@example.com", phone: "3055550100", babyAge: "Newborn (0–2 weeks)" },
  address: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139" },
});

const draft = (babies: unknown[]) => ({
  state: { ...initialState, bundleId: "little-moments", babies },
  backdrops: [],
  month: "2026-11",
  appliedCode: null,
  openedAt: 1,
  requestId: null,
});

describe("baby gender (optional, boy or girl)", () => {
  test("the booking API accepts boy, girl or nothing, and nothing else", () => {
    expect(bookingRequestSchema.safeParse(request([{ age: "Newborn (0–2 weeks)", gender: "girl" }, { age: "2–6 weeks", gender: "boy" }])).success).toBe(true);
    expect(bookingRequestSchema.safeParse(request([{ age: "Newborn (0–2 weeks)" }])).success).toBe(true);
    expect(bookingRequestSchema.safeParse(request([{ age: "Newborn (0–2 weeks)", gender: "other" }])).success).toBe(false);
    expect(bookingRequestSchema.safeParse(request([{ age: "Newborn (0–2 weeks)", gender: "" }])).success).toBe(false);
  });

  test("studio, booking-page and email labels show it before the age", () => {
    const babies = [{ name: "Luna", age: "Newborn (0–2 weeks)", gender: "girl" as const }, { age: "Not born yet" }];
    expect(babiesLabel(babies)).toBe("Luna (Girl, Newborn (0–2 weeks)), Baby 2 (Not born yet)");
    expect(bookingBabiesLabel(babies, en.bookingFlow.details)).toBe("Luna (Girl, Newborn (0–2 weeks)), Baby 2 (Not born yet)");
    expect(bookingBabiesLabel([{ name: "", age: "2–6 weeks", gender: "boy" }, { name: "", age: "2–6 weeks", gender: "" }], es.bookingFlow.details)).toBe(
      "Bebé 1 (Niño, 2–6 semanas), Bebé 2 (2–6 semanas)",
    );
    expect(customerBabiesLabel(babies, "es")).toBe("Luna (Niña, Recién nacido (0–2 semanas)), Bebé 2 (Aún no ha nacido)");
  });

  test("a language switch keeps drafts saved before gender existed and rejects unknown values", () => {
    expect(isLanguageDraftPayload(draft([{ name: "", age: "" }]), "little-moments")).toBe(true);
    expect(isLanguageDraftPayload(draft([{ name: "", age: "", gender: "girl" }]), "little-moments")).toBe(true);
    expect(isLanguageDraftPayload(draft([{ name: "", age: "", gender: "other" }]), "little-moments")).toBe(false);
  });

  test("server logs never keep it", () => {
    expect(sanitizeLogFields({ reference: "TH-123", gender: "girl" })).toEqual({ reference: "TH-123" });
  });
});
