import { describe, expect, test } from "vitest";
import { internalQuickRequestEmail } from "@/emails/Internal";
import { quickRequestSchema } from "@/lib/quick/validation";

const ok = { parentName: "Ana Rivera", phone: "(305) 555-0133", email: "Ana@Example.com ", zip: "33139", locale: "en" };

describe("quick form (/quick)", () => {
  test("name, phone, email and ZIP code are enough", () => {
    const r = quickRequestSchema.parse(ok);
    expect(r.email).toBe("ana@example.com");
    expect(r.babyName).toBeUndefined();
    expect(r.bundleId).toBeUndefined();
  });
  test("each missing required field names itself (the form shows its own message)", () => {
    const issue = (patch: Record<string, unknown>) => quickRequestSchema.safeParse({ ...ok, ...patch }).error?.issues[0]?.message;
    expect(issue({ parentName: "A" })).toBe("name");
    expect(issue({ phone: "305-555" })).toBe("phone");
    expect(issue({ email: "ana@" })).toBe("email");
    expect(issue({ zip: "3313" })).toBe("zip");
  });
  test("optional fields: empty means not given; the age must be one of the booking form's", () => {
    const r = quickRequestSchema.parse({ ...ok, babyName: " ", dueDate: "", bundleId: "", bestTime: "", babyAge: "Not born yet" });
    expect([r.babyName, r.dueDate, r.bundleId, r.bestTime]).toEqual([undefined, undefined, undefined, undefined]);
    expect(quickRequestSchema.safeParse({ ...ok, babyAge: "5 years" }).success).toBe(false);
  });
  test("the studio's email: every detail, no React text markers", async () => {
    for (const bundleName of ["Our Little Story", null]) {
      const mail = await internalQuickRequestEmail({ parentName: "Ana Rivera", phone: "3055550133", email: "ana@example.com", zip: "33139", babyName: "Mia", babyAge: "Not born yet", dueDate: "2026-12-20", bundleName, bestTime: "weekday mornings", message: "Cream set please", locale: "es", adminUrl: "https://www.tinyhumans.photography/admin/quotes" });
      expect(mail.html).not.toContain("<!-- -->");
      for (const bit of ["Ana Rivera", "3055550133", "33139", "Mia", "due Sunday, December 20, 2026", "weekday mornings", "Cream set please", "Spanish", "/admin/quotes", "Text Ana at"]) expect(mail.html).toContain(bit);
      expect(mail.subject).toContain("Ana Rivera");
    }
  });
});
