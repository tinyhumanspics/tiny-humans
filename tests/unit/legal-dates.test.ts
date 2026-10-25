import { describe, expect, test } from "vitest";
import { termsUpdatedAt } from "@/config/legal";

describe("Terms 'Last updated' date", () => {
  const written = "2026-10-07";
  test("follows the latest save of a setting the Terms quote", () => {
    expect(termsUpdatedAt(written, ["2026-10-08T15:00:00.000Z", "2026-10-24T14:30:00.000Z"])).toBe("2026-10-24T14:30:00.000Z");
    expect(termsUpdatedAt(written, [null, "2026-10-08T15:00:00.000Z"])).toBe("2026-10-08T15:00:00.000Z");
  });
  test("keeps the written date when nothing newer was saved", () => {
    expect(termsUpdatedAt(written, [null, undefined])).toBeNull();
    expect(termsUpdatedAt(written, ["2026-10-01T12:00:00.000Z"])).toBeNull();
    expect(termsUpdatedAt(written, ["not a date"])).toBeNull();
  });
});
