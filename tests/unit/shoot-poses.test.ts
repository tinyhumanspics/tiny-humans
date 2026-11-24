import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { POSE_LIMITS, poseTitle } from "@/lib/shoots/poses";
import { dayKeys, inspoKey, poseKey, progressOf, TICK_KEY } from "@/lib/shoots/ticks";
import { poseOrderSchema, posePatchSchema, tickSchema } from "@/lib/shoots/validation";

/** Signature poses (owner, Nov 24): every shoot gets them, ticked per shoot on the day sheet. */

const POSE_A = "a1111111-1111-4111-8111-111111111111";
const POSE_B = "b2222222-2222-4222-8222-222222222222";
const STYLED = "0b6f5a3e-1111-4222-8333-944455556666";
const INSPO = "c3333333-3333-4333-8333-333333333333";

const shoot = (key: string, inspo: string[] = []) => ({
  key,
  tabLabel: key,
  booking: null,
  bringExtra: [],
  inspo: inspo.map((id) => ({ id })) as never,
});

describe("signature poses: ticks", () => {
  test("each shoot ticks each pose on its own, and the API accepts those keys", () => {
    for (const key of [poseKey("b-TH-20261103-4821", POSE_A), poseKey(STYLED, POSE_B)]) {
      expect(TICK_KEY.test(key)).toBe(true);
      expect(tickSchema.safeParse({ date: "2026-11-16", key, on: true }).success).toBe(true);
    }
    for (const bad of [`pose:${POSE_A}`, `pose:b-TH-1:${POSE_A}`, `pose:b-TH-20261103-4821:${POSE_A}:x`, "pose:x:y", `pose:b-TH-20261103-4821:${POSE_A.toUpperCase()}`]) {
      expect(TICK_KEY.test(bad)).toBe(false);
    }
  });

  test("a day counts every pose once per shoot, after that shoot's inspo", () => {
    const shoots = [shoot("b-TH-20261103-4821", [INSPO]), shoot(STYLED)];
    const keys = dayKeys("2026-11-16", shoots, [], [{ id: POSE_A }, { id: POSE_B }]);
    expect(keys).toEqual([
      inspoKey(INSPO),
      poseKey("b-TH-20261103-4821", POSE_A),
      poseKey("b-TH-20261103-4821", POSE_B),
      poseKey(STYLED, POSE_A),
      poseKey(STYLED, POSE_B),
    ]);
    // a pose done for one family isn't done for the other
    expect(progressOf(keys, [poseKey("b-TH-20261103-4821", POSE_A)])).toEqual({ ticked: 1, total: 5 });
    // no poses yet: the day is what it was before
    expect(dayKeys("2026-11-16", shoots, [])).toEqual([inspoKey(INSPO)]);
  });
});

describe("signature poses: owner input", () => {
  test("name and how to set it up (one step per line)", () => {
    expect(posePatchSchema.parse({ name: "  Chin on hands ", steps: " Pillow under the hips \n\n Towel under the chest\npillow under the hips" })).toEqual({
      name: "Chin on hands",
      steps: ["Pillow under the hips", "Towel under the chest"],
    });
    expect(posePatchSchema.safeParse({}).success).toBe(false);
    expect(posePatchSchema.safeParse({ name: "x".repeat(POSE_LIMITS.nameLength + 1) }).success).toBe(false);
    expect(posePatchSchema.safeParse({ steps: Array.from({ length: POSE_LIMITS.steps + 1 }, (_, i) => `Step ${i}`).join("\n") }).success).toBe(false);
    expect(posePatchSchema.safeParse({ name: "A", sort: 2 }).success).toBe(false);
  });

  test("a new order lists each pose once", () => {
    expect(poseOrderSchema.safeParse({ order: [POSE_B, POSE_A] }).success).toBe(true);
    expect(poseOrderSchema.safeParse({ order: [POSE_A, POSE_A] }).success).toBe(false);
    expect(poseOrderSchema.safeParse({ order: [] }).success).toBe(false);
    expect(poseOrderSchema.safeParse({ order: ["nope"] }).success).toBe(false);
  });

  test("a pose without a name still reads well", () => {
    expect(poseTitle({ name: "  " })).toBe("Untitled pose");
    expect(poseTitle({ name: "Taco" })).toBe("Taco");
  });
});

describe("signature poses: database step", () => {
  test("migration 0046 only adds (safe to run twice)", () => {
    const sql = readFileSync("drizzle/0046_signature_poses.sql", "utf8");
    // no statement drops, changes or deletes anything ("ON DELETE cascade" only links a photo to its pose)
    expect(sql).not.toMatch(/^\s*(drop|alter|delete|truncate|update|insert)\b/im);
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });
});

describe("family photo inspo (owner, Nov 24)", () => {
  test("only bundles with the family get the list; a shoot that already has some keeps it", async () => {
    const { showsFamilyPhotos } = await import("@/lib/shoots/sections");
    const booking = (siblings: boolean) => ({ siblings }) as never;
    expect(showsFamilyPhotos({ booking: booking(true), inspo: [] })).toBe(true);
    expect(showsFamilyPhotos({ booking: booking(false), inspo: [] })).toBe(false);
    expect(showsFamilyPhotos({ booking: null, inspo: [] })).toBe(false);
    expect(showsFamilyPhotos({ booking: booking(false), inspo: [{ group: "family" }] as never })).toBe(true);
  });

  test("family shots can be added, but the owner's own sections stay in Inspo and BTS", async () => {
    const { newInspoSchema, newSectionSchema } = await import("@/lib/shoots/validation");
    expect(newInspoSchema.safeParse({ type: "note", group: "family", caption: "" }).success).toBe(true);
    expect(newSectionSchema.safeParse({ group: "family", name: "Outfit 2" }).success).toBe(false);
  });

  test("migration 0047 only widens the check, and says so for the deploy", async () => {
    const sql = readFileSync("drizzle/0047_family_inspo.sql", "utf8");
    expect(sql).toMatch(/^--\s*destructive-ok:\s*\S/m);
    expect(sql).toMatch(/in \('inspo', 'bts', 'family'\)/);
    expect(sql).not.toMatch(/^\s*(delete|update|truncate|drop table)\b/im);
  });
});
