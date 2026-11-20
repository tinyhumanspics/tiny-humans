import { describe, expect, test } from "vitest";
import { babiesLabel, babiesShort } from "@/lib/booking/extra-babies";
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
    // a website request has no age yet (owner, Nov 19): no empty slot after the comma
    expect(customerBabiesLabel([{ name: "Mia", age: "", gender: "girl" }], "en")).toBe("Mia (Girl)");
    expect(bookingBabiesLabel([{ name: "Mia", age: "", gender: "girl" }], en.bookingFlow.details)).toBe("Mia (Girl)");
    expect(customerBabiesLabel([{ name: "Mia", age: "" }], "en")).toBe("Mia");
  });

  test("the Leads card shows names and boy or girl, once the family says (owner, Nov 20)", () => {
    expect(babiesShort([{ name: "Mia", age: "", gender: "girl" }])).toBe("Mia (Girl)");
    expect(babiesShort([{ age: "", gender: "boy" }])).toBe("Boy");
    expect(babiesShort([{ name: "Mia", age: "Newborn (0–2 weeks)" }])).toBe("Mia");
    expect(babiesShort([{ age: "" }])).toBe("");
    expect(babiesShort([{ age: "", gender: "boy" }, { age: "", gender: "girl" }])).toBe("Baby 1 (Boy), Baby 2 (Girl)");
    expect(babiesShort([{ age: "" }, { age: "" }])).toBe("");
  });

  test("server logs never keep it", () => {
    expect(sanitizeLogFields({ reference: "TH-123", gender: "girl" })).toEqual({ reference: "TH-123" });
  });
});
