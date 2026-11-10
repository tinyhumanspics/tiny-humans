import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  autoConfirmOf,
  bookingFacts,
  bookingKeyOf,
  bundleLine,
  familyNameOf,
  familyTitles,
  hoursLabel,
  inspoTitleOf,
  referenceOfKey,
  whoLineOf,
  type BookingSource,
} from "@/lib/shoots/from-bookings";
import { normalizeLink, platformOf } from "@/lib/shoots/links";
import { DEFAULT_BRING_SECTIONS, linesOf } from "@/lib/shoots/lists";
import { sunsetOn } from "@/lib/shoots/sunset";
import { addonKey, backdropKey, bringLists, dayKeys, extraKey, hashText, inspoKey, progressOf, sectionItemKey, TICK_KEY } from "@/lib/shoots/ticks";
import type { BringSection, InspoItem } from "@/lib/shoots/types";
import { dateSchema, newInspoSchema, shootKeySchema, shootPatchSchema, tickSchema } from "@/lib/shoots/validation";
import { byStart, shootDetail } from "@/lib/shoots/view";

/** A booking as booking-source.ts hands it over (Our Little Story, 9:00 to 11:00 Miami time). */
const booking = (over: Partial<BookingSource> = {}): BookingSource => ({
  id: "0b6f5a3e-1111-4222-8333-944455556666",
  reference: "TH-20261103-4821",
  status: "confirmed",
  parentName: "Maria Morales",
  sessionDate: "2026-11-16",
  sessionStart: new Date("2026-11-16T14:00:00.000Z"),
  sessionEnd: new Date("2026-11-16T16:00:00.000Z"),
  timezone: "America/New_York",
  packageName: "Our Little Story",
  packageInclusions: ["Up to 2 hours", "Baby only", "2 setups", "20 edited digital photos"],
  babyName: "Sofia",
  babyAge: "Newborn (0–2 weeks)",
  babies: [],
  backdropPicks: ["cream"],
  addons: [],
  pick: { id: "basket-nap", title: "Basket nap", src: "/portfolio/basket-nap.jpg" },
  notes: "  Sofia sleeps best right after her 9:00 feed.  ",
  address: "1500 Bay Rd, Miami Beach, FL 33139",
  city: "Miami Beach",
  deposit: { status: "paid", amountCents: 5000 },
  ...over,
});

const item = (id: string, group: "inspo" | "bts", sort = 0): InspoItem => ({
  id,
  group,
  type: "note",
  mediaUrl: null,
  contentType: null,
  width: null,
  height: null,
  linkUrl: null,
  platform: null,
  caption: "",
  sort,
});

const IDS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];

describe("shoots: what a booking feeds in", () => {
  test("title, times, bundle line, backdrops, people and the family's notes come from the booking's snapshot", () => {
    const f = bookingFacts(booking());
    expect(f).toMatchObject({
      reference: "TH-20261103-4821",
      date: "2026-11-16",
      start: "09:00",
      end: "11:00",
      durationMinutes: 120,
      defaultTitle: "The Morales family",
      defaultTabLabel: "Morales",
      backdropsAllowed: 2,
      people: "Baby only",
      siblings: false,
      babies: [{ name: "Sofia", age: "Newborn (0–2 weeks)" }],
      backdrops: [{ id: "cream", name: "Cream", color: "#efe3cc" }],
      notes: "Sofia sleeps best right after her 9:00 feed.",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=1500%20Bay%20Rd%2C%20Miami%20Beach%2C%20FL%2033139",
      deposit: { status: "paid", amountCents: 5000 },
    });
    expect(bundleLine(f)).toBe("Our Little Story · 2 h · 2 backdrops");
  });

  test("twins come from booking_babies; unknown backdrop ids are dropped; siblings show on Who's on camera", () => {
    const f = bookingFacts(
      booking({
        packageName: "Our Family Story",
        packageInclusions: ["Up to 3 hours", "Baby + parents + siblings", "3 setups"],
        babies: [{ name: "Ava", age: "Newborn (0–2 weeks)" }, { name: " ", age: "Newborn (0–2 weeks)" }],
        backdropPicks: ["burgundy", "retired-backdrop"],
        sessionEnd: new Date("2026-11-16T17:30:00.000Z"),
      }),
    );
    expect(f.babies).toEqual([
      { name: "Ava", age: "Newborn (0–2 weeks)" },
      { name: null, age: "Newborn (0–2 weeks)" },
    ]);
    expect(f.backdrops.map((b) => b.id)).toEqual(["burgundy"]);
    expect(f.siblings).toBe(true);
    expect(f.people).toBe("Baby + parents + siblings");
    expect(bundleLine(f)).toBe("Our Family Story · 3 h 30 min · 3 backdrops");
    expect(whoLineOf(f)).toBe("Ava, newborn (0–2 weeks) and Baby 2, newborn (0–2 weeks), with parents and siblings");
    expect(inspoTitleOf(f)).toBe("Inspo for the babies");
  });

  test("family names and headings", () => {
    expect(familyNameOf("Ana María López Jr.")).toBe("López");
    expect(familyTitles("Maria Morales")).toEqual({ title: "The Morales family", tabLabel: "Morales" });
    expect(familyTitles("Maria")).toEqual({ title: "Maria's family", tabLabel: "Maria" });
    expect(familyTitles("  ")).toEqual({ title: "The family", tabLabel: "Family" });
    expect(inspoTitleOf({ babies: [{ name: "Ava", age: "x" }, { name: "Mila", age: "x" }] })).toBe("Inspo for Ava and Mila");
    expect(inspoTitleOf({ babies: [{ name: null, age: "x" }] })).toBe("Inspo for the baby");
    expect(inspoTitleOf(null)).toBe("Inspo for the set");
    expect(whoLineOf(null)).toBe("No baby: just the set");
    expect(hoursLabel(60)).toBe("1 h");
    expect(hoursLabel(45)).toBe("45 min");
  });

  test("backdrop check: fewer picks than the bundle allows adds a Still to confirm line", () => {
    expect(autoConfirmOf({ backdrops: [{ id: "cream", name: "Cream", color: "#fff" }], backdropsAllowed: 2 })).toEqual([
      "Backdrops: 1 of 2 picked. The family picks the rest on their backdrop page.",
    ]);
    expect(autoConfirmOf({ backdrops: [], backdropsAllowed: 1 })).toEqual(["Backdrops: 0 of 1 picked. The family picks the rest on their backdrop page."]);
    expect(autoConfirmOf({ backdrops: [{ id: "white", name: "White", color: "#fff" }], backdropsAllowed: 1 })).toEqual([]);
    expect(autoConfirmOf(null)).toEqual([]);
  });

  test("folder keys: b-<reference> for bookings", () => {
    expect(bookingKeyOf("TH-20261103-4821")).toBe("b-TH-20261103-4821");
    expect(referenceOfKey("b-TH-20261103-4821")).toBe("TH-20261103-4821");
    expect(referenceOfKey("b-TH-2026-1")).toBeNull();
    expect(shootKeySchema.safeParse("b-TH-20261103-4821").success).toBe(true);
    expect(shootKeySchema.safeParse(IDS[0]).success).toBe(true);
    expect(shootKeySchema.safeParse("../etc").success).toBe(false);
  });
});

describe("shoots: folder view", () => {
  test("a booking nobody edited yet: notes prefill What the family asked for; times follow the booking", () => {
    const d = shootDetail(bookingFacts(booking()), null, [item(IDS[1], "bts"), item(IDS[0], "inspo")]);
    expect(d).toMatchObject({ key: "b-TH-20261103-4821", id: null, title: "The Morales family", start: "09:00", said: "Sofia sleeps best right after her 9:00 feed.", saidFromBooking: true, inspoCount: 1, btsCount: 1, place: "Miami Beach" });
    expect(d.inspo.map((i) => i.group)).toEqual(["inspo", "bts"]);
    expect(d.autoConfirm).toHaveLength(1);
  });

  test("the owners' row wins (an empty What they asked for stays empty), but never the day or time", () => {
    const row = { id: IDS[2], kind: "booking" as const, date: "2026-12-01", startTime: "15:00", place: "Elsewhere", title: "Sofia's newborn", tabLabel: "", said: "", confirm: ["Leo in a few?"], bringExtra: ["Small stool for Leo"] };
    const d = shootDetail(bookingFacts(booking({ sessionDate: "2026-11-20" })), row, []);
    expect(d).toMatchObject({ key: "b-TH-20261103-4821", id: IDS[2], date: "2026-11-20", start: "09:00", title: "Sofia's newborn", tabLabel: "Morales", said: "", saidFromBooking: false, confirm: ["Leo in a few?"] });
  });

  test("a shoot without a booking", () => {
    const d = shootDetail(null, { id: IDS[0], kind: "styled", date: "2026-11-19", startTime: "15:00", place: "Our place", title: "First Christmas set test", tabLabel: "Christmas set", said: null, confirm: [], bringExtra: [] }, []);
    expect(d).toMatchObject({ key: IDS[0], kind: "styled", bundleLine: null, inspoTitle: "Inspo for the set", whoLine: "No baby: just the set", place: "Our place", said: "" });
    expect([{ start: null, title: "B" }, { start: "13:00", title: "A" }, { start: "09:00", title: "C" }].sort(byStart).map((s) => s.title)).toEqual(["C", "A", "B"]);
  });
});

describe("shoots: pasted links", () => {
  test("platform detection", () => {
    expect(platformOf("https://www.instagram.com/reel/abc/")).toBe("Instagram");
    expect(platformOf("instagram.com/p/abc")).toBe("Instagram");
    expect(platformOf("https://vm.tiktok.com/ZM123/")).toBe("TikTok");
    expect(platformOf("https://pin.it/abc")).toBe("Pinterest");
    expect(platformOf("https://www.pinterest.co.uk/pin/1/")).toBe("Pinterest");
    expect(platformOf("https://youtu.be/xyz")).toBe("YouTube");
    expect(platformOf("https://m.youtube.com/watch?v=xyz")).toBe("YouTube");
    expect(platformOf("https://vimeo.com/1")).toBe("Vimeo");
    expect(platformOf("https://www.example.com/a")).toBe("example.com");
    expect(platformOf("javascript:alert(1)")).toBeNull();
  });

  test("links are cleaned up or refused", () => {
    expect(normalizeLink("  instagram.com/p/abc  ")).toBe("https://instagram.com/p/abc");
    expect(normalizeLink("https://user:pass@example.com/")).toBeNull();
    expect(normalizeLink("ftp://example.com/a")).toBeNull();
    expect(normalizeLink("data:text/html,hi")).toBeNull();
    expect(normalizeLink("two words")).toBeNull();
    expect(normalizeLink("localhost/a")).toBeNull();
    const ok = newInspoSchema.safeParse({ type: "link", group: "bts", url: "tiktok.com/@x/video/1", caption: " Twirl " });
    expect(ok.success && ok.data).toEqual({ type: "link", group: "bts", url: "https://tiktok.com/@x/video/1", caption: "Twirl" });
    expect(newInspoSchema.safeParse({ type: "link", group: "bts", url: "not a link" }).success).toBe(false);
    expect(newInspoSchema.safeParse({ type: "note", group: "nope", caption: "x" }).success).toBe(false);
  });
});

describe("shoots: ticks and What to bring", () => {
  const sections: BringSection[] = [
    { id: IDS[1], name: "Camera gear", items: ["Tripod"], sort: 1 },
    { id: IDS[0], name: "Studio kit", items: ["Space heater", "Step stool"], sort: 0 },
    { id: IDS[2], name: "", items: [], sort: 2 },
  ];

  test("item hash is stable and ignores case and spacing", () => {
    expect(hashText("Space heater")).toBe(hashText("  space   HEATER "));
    expect(hashText("Space heater")).not.toBe(hashText("Step stool"));
    expect(hashText("Space heater")).toMatch(/^[0-9a-z]+$/);
  });

  test("every key the day sheet makes is one the API accepts", () => {
    const keys = [
      inspoKey(IDS[0]),
      sectionItemKey("2026-11-16", IDS[0], "Space heater"),
      backdropKey("2026-11-16", "b-TH-20261103-4821", "darkGreen"),
      extraKey("2026-11-16", IDS[2], "Santa hat, 3 to 6 months (only if they say yes)"),
      addonKey("2026-11-16", "b-TH-20261103-4821", "Extra baby"),
    ];
    for (const key of keys) expect(tickSchema.safeParse({ date: "2026-11-16", key, on: true }).success).toBe(true);
    for (const bad of ["inspo:1", "bring:2026-11-16", "bring:2026-11-16:a b:c", "hello", `inspo:${IDS[0]}:x`, "bring:2026-11-16:a:b:c:d"]) expect(TICK_KEY.test(bad)).toBe(false);
  });

  test("What to bring: backdrops (with the family), booked add-ons + Bring extra, then sections with items in order", () => {
    const f = bookingFacts(booking({ backdropPicks: ["cream", "wooden"], addons: [{ name: "Extra baby", quantity: 1, extraMinutes: 30 }] }));
    const shoot = shootDetail(f, { id: IDS[2], kind: "booking", date: null, startTime: null, place: null, title: null, tabLabel: null, said: null, confirm: [], bringExtra: ["Small stool for Leo"] }, [item(IDS[0], "inspo")]);
    const b = bringLists("2026-11-16", [shoot], sections);
    expect(b.backdrops).toEqual([
      { key: "bring:2026-11-16:bd:b-TH-20261103-4821:cream", text: "Cream backdrop", who: "Morales", color: "#efe3cc" },
      { key: "bring:2026-11-16:bd:b-TH-20261103-4821:wooden", text: "Wooden backdrop", who: "Morales", color: "#9a6a42" },
    ]);
    expect(b.extras.map((e) => e.text)).toEqual(["Extra baby (booked add-on)", "Small stool for Leo"]);
    expect(b.sections.map((s) => s.name)).toEqual(["Studio kit", "Camera gear"]);
    const keys = dayKeys("2026-11-16", [shoot], sections);
    expect(keys).toHaveLength(1 + 2 + 2 + 3);
    expect(keys[0]).toBe(inspoKey(IDS[0]));
    expect(progressOf(keys, [keys[0], keys[3], "inspo:gone"])).toEqual({ ticked: 2, total: 8 });
  });
});

describe("shoots: owner input", () => {
  test("one per line: trimmed, blank lines dropped, each line once", () => {
    expect(linesOf("  Tripod \n\nTripod\n tripod\nLight +   softbox\r\n")).toEqual(["Tripod", "Light + softbox"]);
    const p = shootPatchSchema.parse({ confirm: "Leo in a few?\n\n", bringExtra: ["Stool", " stool "] });
    expect(p).toEqual({ confirm: ["Leo in a few?"], bringExtra: ["Stool"] });
    expect(shootPatchSchema.safeParse({ bookingId: "x" }).success).toBe(false);
  });

  test("days must exist", () => {
    expect(dateSchema.safeParse("2026-11-16").success).toBe(true);
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateSchema.safeParse("16/11/2026").success).toBe(false);
  });
});

describe("shoots: sunset and starting lists", () => {
  test("sunset in Miami Beach (NOAA), Miami time", () => {
    expect(sunsetOn("2026-11-16")).toBe("17:31");
    expect(sunsetOn("2026-06-21")).toBe("20:15");
  });

  test("migration 0023 inserts exactly lib/shoots/lists.ts", () => {
    const sql = readFileSync("drizzle/0023_shoots.sql", "utf8");
    const rows = [...sql.matchAll(/\t\('((?:[^']|'')*)', '((?:[^']|'')*)', (\d+)\)/g)].map((m) => ({
      name: m[1].replace(/''/g, "'"),
      items: JSON.parse(m[2].replace(/''/g, "'")) as string[],
      sort: Number(m[3]),
    }));
    expect(rows).toEqual(DEFAULT_BRING_SECTIONS.map((s, sort) => ({ name: s.name, items: s.items, sort })));
    expect(sql).not.toMatch(/^(CREATE TABLE|CREATE INDEX|ALTER TABLE)(?! IF NOT EXISTS)/m);
  });
});
