import { describe, expect, test, vi } from "vitest";
import { FAMILY_INCLUDED_PEOPLE, MAX_FAMILY_MEMBERS } from "@/config/booking";
import { extraPeopleCount, extraPersonLine, familyLimit, withAddons } from "@/lib/booking/extra-babies";
import { bookingPricingRows } from "@/lib/booking/customer-page-format";
import { customerPricingRows } from "@/lib/email/customer-format";
import { computeQuote } from "@/lib/pricing/engine";
import type { Bundle } from "@/lib/pricing/types";
import en from "@/messages/en.json";
import { asksFamily, cleanFamily, familyLabel } from "@/lib/booking/family";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { customerFamilyLabel } from "@/lib/email/customer-format";
import { whoLineOf } from "@/lib/shoots/from-bookings";
import { cleanWho, groupByWho, peopleOf, picksWho, toggleWho, whoLabel, WHO_ALL } from "@/lib/shoots/people";
import type { InspoItem, ShootBaby } from "@/lib/shoots/types";
import { inspoPatchSchema } from "@/lib/shoots/validation";
import { filledFamily } from "@/features/booking/flow/booking-state";

vi.mock("server-only", () => ({}));

/**
 * Owner, Nov 10: Our Family Story includes 5 people counting the baby; each person over that is +$75 like an extra baby
 * (role + optional name each); twins/family shots by who's in them.
 */

const request = (family: unknown) => ({
  bundleId: "forever-little",
  slot: { date: "2026-12-01", start: "10:00" },
  contact: { parentName: "Ana Morales", email: "ana@example.com", phone: "305 555 0142", babyAge: "Newborn (0–2 weeks)" },
  address: { street: "1500 Bay Rd", city: "Miami Beach", zip: "33139" },
  family,
});

describe("family members on the booking", () => {
  test("only bundles that include the family ask (Our Family Story)", () => {
    expect(asksFamily({ people: "Baby + parents + siblings", features: [] })).toBe(true);
    expect(asksFamily({ people: "", features: ["Up to 1 hour", "Baby only"] })).toBe(false);
  });

  test("the request: role required, name optional, at most the hard cap", () => {
    const ok = bookingRequestSchema.safeParse(request([{ role: "mom", name: " Ana " }, { role: "brother", name: "" }]));
    expect(ok.success && ok.data.family).toEqual([{ role: "mom", name: "Ana" }, { role: "brother", name: undefined }]);
    expect(bookingRequestSchema.safeParse(request([{ role: "neighbor" }])).success).toBe(false);
    expect(bookingRequestSchema.safeParse(request(Array.from({ length: MAX_FAMILY_MEMBERS + 1 }, () => ({ role: "cousin" })))).success).toBe(false);
    // older pages send no family at all
    expect(bookingRequestSchema.safeParse(request(undefined)).success).toBe(true);
  });

  test("whatever comes in is cleaned: unknown roles and empty rows dropped, names trimmed, 5 kept", () => {
    expect(cleanFamily([{ role: "dad", name: "  " }, { role: "", name: "x" }, { role: "grandma", name: " Rosa " }, null, "mom"])).toEqual([{ role: "dad" }, { role: "grandma", name: "Rosa" }]);
    expect(cleanFamily(Array.from({ length: MAX_FAMILY_MEMBERS + 3 }, () => ({ role: "aunt" })))).toHaveLength(MAX_FAMILY_MEMBERS);
    expect(cleanFamily(undefined)).toEqual([]);
  });

  test("how the studio and the family read it", () => {
    const family = cleanFamily([{ role: "mom", name: "Ana" }, { role: "dad" }, { role: "brother", name: "Leo" }]);
    expect(familyLabel(family)).toBe("Mom (Ana), Dad, Brother (Leo)");
    expect(customerFamilyLabel(family, "es")).toBe("Mamá (Ana), Papá, Hermano (Leo)");
  });
});

describe("the booking form's family list is optional", () => {
  test("empty rows are left out; a name without a role is kept as other; names trimmed", () => {
    expect(filledFamily([])).toEqual([]);
    expect(filledFamily([{ role: "", name: "  " }])).toEqual([]);
    expect(filledFamily([{ role: "mom", name: " Ana " }, { role: "", name: "" }, { role: "", name: "Carlos" }, { role: "dad", name: "" }])).toEqual([
      { role: "mom", name: "Ana" },
      { role: "other", name: "Carlos" },
      { role: "dad" },
    ]);
  });
});

describe("extra family members are charged like an extra baby", () => {
  const family: Bundle = {
    id: "forever-little", name: "Our Family Story", price: 399, duration: "Up to 3 hours", durationMinutes: 180, people: "", setups: "", photos: "35",
    features: ["Up to 3 hours", "Baby + parents + siblings", "3 setups"], locationNote: "", cta: "",
    extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
    extraPerson: { active: true, price: 75, maxExtra: 5 },
  };

  test("5 people included, babies counted; twins leave room for 3", () => {
    expect(FAMILY_INCLUDED_PEOPLE).toBe(5);
    expect(extraPeopleCount(1, 4)).toBe(0);
    expect(extraPeopleCount(1, 5)).toBe(1);
    expect(extraPeopleCount(2, 4)).toBe(1);
    expect(familyLimit(family, 1)).toBe(9);
    expect(familyLimit(family, 2)).toBe(8);
    expect(familyLimit({ ...family, extraPerson: { active: false, price: 75, maxExtra: 5 } }, 1)).toBe(4);
    expect(familyLimit({ ...family, extraPerson: null }, 3)).toBe(2);
  });

  test("the line: $75 each, never over the bundle's maximum; offers and codes never touch it", () => {
    expect(extraPersonLine(family, 1, 4)).toBeNull();
    expect(extraPersonLine(family, 1, 6)).toMatchObject({ kind: "extra_person", name: "Extra family members", quantity: 2, unitPriceCents: 7500, totalCents: 15000, extraMinutes: 0, extraPhotos: 0 });
    expect(extraPersonLine(family, 1, 11)).toBeNull();
    const quote = withAddons(computeQuote(family, "2026-11-10"), family, 2, 4);
    expect(quote.addons.map((a) => [a.kind, a.quantity, a.totalCents])).toEqual([["extra_baby", 1, 7500], ["extra_person", 1, 7500]]);
    expect(quote.totalCents).toBe(39900 + 15000);
  });

  test("how families read it: booking page in English, email in Spanish", () => {
    const quote = withAddons(computeQuote(family, "2026-11-10"), family, 1, 6);
    expect(bookingPricingRows(quote, family, en.bookingFlow.review)).toContainEqual(["Extra family members", "2 × $75 = $150"]);
    expect(customerPricingRows(quote, "es")).toContainEqual(["Familiares adicionales", "2 × $75 = $150"]);
  });
});

const babies: ShootBaby[] = [
  { name: "Ava", age: "Newborn (0–2 weeks)", gender: "girl" },
  { name: null, age: "Newborn (0–2 weeks)", gender: null },
];
const family = cleanFamily([{ role: "mom" }, { role: "dad" }, { role: "brother", name: "Leo" }, { role: "mom" }]);
const item = (id: string, who: string[]): InspoItem => ({ id, group: "inspo", type: "note", mediaUrl: null, contentType: null, width: null, height: null, linkUrl: null, platform: null, caption: id, who, sort: 0 });

describe("shoots: who's in each shot", () => {
  const people = peopleOf({ babies, family });

  test("everyone the booking lists, babies first, repeated labels numbered", () => {
    expect(people.map((p) => [p.key, p.label, p.detail])).toEqual([
      ["baby:0", "Ava", "Girl · Newborn (0–2 weeks)"],
      ["baby:1", "Baby 2", "Newborn (0–2 weeks)"],
      ["fam:0", "Mom", null],
      ["fam:1", "Dad", null],
      ["fam:2", "Brother (Leo)", null],
      ["fam:3", "Mom 2", null],
    ]);
    expect(picksWho(peopleOf({ babies: [babies[0]], family: [] }))).toBe(false);
    expect(picksWho(people)).toBe(true);
    expect(whoLineOf({ babies, siblings: true, family: family.slice(0, 3) })).toBe("Ava, newborn (0–2 weeks) and Baby 2, newborn (0–2 weeks), with Mom, Dad, Brother (Leo)");
    expect(whoLineOf({ babies: [babies[0]], siblings: true, family: [] })).toBe("Ava, newborn (0–2 weeks), with parents and siblings");
  });

  test("tapping chips: Everyone stands alone; people keep the booking's order; unknown keys dropped", () => {
    expect(toggleWho([], "fam:1", people)).toEqual(["fam:1"]);
    expect(toggleWho(["fam:1"], "fam:2", people)).toEqual(["fam:1", "fam:2"]);
    expect(toggleWho(["fam:2"], "baby:0", people)).toEqual(["baby:0", "fam:2"]);
    expect(toggleWho(["baby:0", "fam:2"], WHO_ALL, people)).toEqual([WHO_ALL]);
    expect(toggleWho([WHO_ALL], "baby:1", people)).toEqual(["baby:1"]);
    expect(toggleWho(["baby:1"], "baby:1", people)).toEqual([]);
    expect(cleanWho(["fam:4", "baby:0", "baby:0"], people)).toEqual(["baby:0"]);
    expect(whoLabel(["fam:0", "fam:1"], people)).toBe("Mom & Dad");
    expect(whoLabel(["baby:0", "baby:1", "fam:2"], people)).toBe("Ava, Baby 2 & Brother (Leo)");
    expect(whoLabel([WHO_ALL], people)).toBe("Everyone together");
  });

  test("day sheet sections: everyone, then groups (bigger first), then each person, then not picked", () => {
    const groups = groupByWho([item("solo-ava", ["baby:0"]), item("loose", []), item("dad-leo", ["fam:1", "fam:2"]), item("all", [WHO_ALL]), item("twins", ["baby:1", "baby:0"]), item("parents", ["fam:0", "fam:1"]), item("solo-2", ["baby:1"]), item("twins-2", ["baby:0", "baby:1"]), item("all-3", ["baby:0", "baby:1", "fam:0"])], people);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Everyone together", ["all"]],
      ["Ava, Baby 2 & Mom", ["all-3"]],
      ["Ava & Baby 2", ["twins", "twins-2"]],
      ["Mom & Dad", ["parents"]],
      ["Dad & Brother (Leo)", ["dad-leo"]],
      ["Ava", ["solo-ava"]],
      ["Baby 2", ["solo-2"]],
      ["Not picked yet", ["loose"]],
    ]);
    expect(groups.find((g) => g.label === "Ava")?.detail).toBe("Girl · Newborn (0–2 weeks)");
  });

  test("the save route only takes this booking's kind of keys", () => {
    expect(inspoPatchSchema.safeParse({ who: ["all"] }).success).toBe(true);
    expect(inspoPatchSchema.safeParse({ who: ["baby:0", "fam:4"] }).success).toBe(true);
    expect(inspoPatchSchema.safeParse({ who: ["fam:5"] }).success).toBe(false);
    expect(inspoPatchSchema.safeParse({ who: ["<script>"] }).success).toBe(false);
    expect(inspoPatchSchema.safeParse({}).success).toBe(false);
    expect(inspoPatchSchema.safeParse({ caption: "Basket nap" }).success).toBe(true);
  });
});
