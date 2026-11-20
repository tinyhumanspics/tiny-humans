import { describe, expect, test } from "vitest";
import { babiesLabel } from "@/lib/booking/extra-babies";
import { bookingBabiesLabel } from "@/lib/booking/customer-page-format";
import { customerBabiesLabel } from "@/lib/email/customer-format";
import { sanitizeLogFields } from "@/lib/security/logging";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("baby gender (optional, boy or girl)", () => {
  test("studio, booking-page and email labels show it before the age", () => {
    const babies = [{ name: "Luna", age: "Newborn (0–2 weeks)", gender: "girl" as const }, { age: "Not born yet" }];
    expect(babiesLabel(babies)).toBe("Luna (Girl, Newborn (0–2 weeks)), Baby 2 (Not born yet)");
    expect(bookingBabiesLabel(babies, en.bookingFlow.details)).toBe("Luna (Girl, Newborn (0–2 weeks)), Baby 2 (Not born yet)");
    expect(bookingBabiesLabel([{ name: "", age: "2–6 weeks", gender: "boy" }, { name: "", age: "2–6 weeks", gender: "" }], es.bookingFlow.details)).toBe(
      "Bebé 1 (Niño, 2–6 semanas), Bebé 2 (2–6 semanas)",
    );
    expect(customerBabiesLabel(babies, "es")).toBe("Luna (Niña, Recién nacido (0–2 semanas)), Bebé 2 (Aún no ha nacido)");
  });

  test("server logs never keep it", () => {
    expect(sanitizeLogFields({ reference: "TH-123", gender: "girl" })).toEqual({ reference: "TH-123" });
  });
});
