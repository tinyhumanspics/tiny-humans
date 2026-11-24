import { describe, expect, test } from "vitest";
import { BACKDROPS, OFFERED_BACKDROPS, offeredOnly } from "@/config/backdrops";
import { backdropList, backdropSwatches } from "@/emails/components/backdrops";
import { backdropPicks } from "@/lib/booking/validation";

/** Owner, Nov 24: Cream isn't offered for now; Dark Green is now Sage Green (same id, so earlier picks stay valid). */
describe("backdrops offered now", () => {
  test("families pick from 7: no Cream", () => {
    expect(OFFERED_BACKDROPS.map((b) => b.id)).toEqual(["blueAura", "burgundy", "darkGreen", "pink", "white", "beige", "wooden"]);
    expect(BACKDROPS.some((b) => b.id === "cream")).toBe(true);
    expect(backdropPicks.safeParse(["cream"]).success).toBe(false);
    expect(backdropPicks.safeParse(["darkGreen", "wooden"]).success).toBe(true);
    expect(offeredOnly(["cream", "wooden"])).toEqual(["wooden"]);
  });

  test("emails: the list of options says Sage Green and leaves Cream out; a family's own earlier pick still shows", () => {
    expect(backdropList("en")).toBe("Blue Aura, Burgundy, Sage Green, Pink, White, Beige or Wooden");
    expect(backdropList("es")).toContain("Verde Salvia");
    expect(backdropList("es")).not.toContain("Crema");
    expect(backdropSwatches("en", "inline").swatches.map((s) => s.name)).not.toContain("Cream");
    expect(backdropSwatches("en", "inline", ["cream", "darkGreen"]).swatches.map((s) => s.name)).toEqual(["Sage Green", "Cream"]);
  });
});
