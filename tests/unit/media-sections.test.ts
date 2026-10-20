import { describe, expect, test } from "vitest";
import { buildFeedFromMedia, emptyThemeMedia, fallbackMediaFor, feedPhotos, resolveMedia, type MediaSection } from "@/config/media";
import { portfolio, type PortfolioPhoto } from "@/config/portfolio";
import { defaultSettings, parseSettings, SettingsInputError, storedSettings } from "@/lib/settings/defaults";
import { spanishOwnerCopyIssues } from "@/i18n/publication-audit";
import type { SiteSettings } from "@/lib/settings/types";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const photo = (n: number, spanish = true): PortfolioPhoto => ({
  id: `photo-${n}`,
  src: `https://store.public.blob.vercel-storage.com/photos/${n}.jpg`,
  width: 900,
  height: 1125,
  title: `Photo ${n}`,
  alt: `Photo ${n}`,
  spanish: spanish ? { title: `Foto ${n}`, alt: `Foto ${n}` } : null,
});
const photos = (from: number, count: number) => Array.from({ length: count }, (_, i) => photo(from + i));
const section = (id: string, list: PortfolioPhoto[], extra: Partial<MediaSection> = {}): MediaSection => ({
  id, photos: list, prompt: true, promptPhotoId: null, title: `${id} title`, text: `${id} text`, spanish: { title: `${id} título`, text: `${id} texto` }, ...extra,
});
const settingsWith = (media: Record<string, unknown>) => parseSettings({ ...defaultSettings, media });
const feedShape = (feed: ReturnType<typeof buildFeedFromMedia>) =>
  feed.map((b) => (b.type === "photos" ? b.photos.map((p) => p.id) : `box:${b.photo.id}:${b.title}|${b.text}`));

/** "Little moments" exactly as production saved it before sections existed (three groups, custom wording on two). */
const legacyDefault = {
  title: [photo(90), photo(91)],
  groups: [
    { photos: photos(1, 3), title: null, text: null, spanish: { title: "¿Te encanta?", text: "Planifiquemos." } },
    { photos: photos(4, 3), title: "Want to save this memory?", text: "Baby, parents and all the tiny details", spanish: { title: "Imagina", text: "Tu bebé" } },
    { photos: photos(7, 3), title: null, text: "Let's catch it before it's too late", spanish: { title: "¿Quieres?", text: "Cada etapa." } },
  ],
  extra: [],
};

describe("settings saved before sections existed", () => {
  test("become sections with the same pictures, wording and order", () => {
    const s = settingsWith({ default: legacyDefault });
    const feed = buildFeedFromMedia(resolveMedia(s.media.default));
    expect(feedShape(feed)).toEqual([
      ["photo-1", "photo-2", "photo-3"], `box:photo-2:${en.home.portfolio.prompts[0].title}|${en.home.portfolio.prompts[0].text}`,
      ["photo-4", "photo-5", "photo-6"], "box:photo-5:Want to save this memory?|Baby, parents and all the tiny details",
      ["photo-7", "photo-8", "photo-9"], `box:photo-8:${en.home.portfolio.prompts[2].title}|Let's catch it before it's too late`,
    ]);
    // the Spanish page now shows the Spanish wording saved in /admin
    expect(feedShape(buildFeedFromMedia(resolveMedia(s.media.default, undefined, "es"))).filter((b) => typeof b === "string")).toEqual([
      "box:photo-2:¿Te encanta?|Planifiquemos.", "box:photo-5:Imagina|Tu bebé", "box:photo-8:¿Quieres?|Cada etapa.",
    ]);
  });

  test("extra pictures become a last section without a box, still in rows of 3", () => {
    const s = settingsWith({ default: { ...legacyDefault, extra: photos(20, 4) } });
    const feed = feedShape(buildFeedFromMedia(resolveMedia(s.media.default)));
    expect(feed.slice(-2)).toEqual([["photo-20", "photo-21", "photo-22"], ["photo-23"]]);
    expect(s.media.default?.sections?.at(-1)).toMatchObject({ prompt: false, photos: photos(20, 4) });
  });

  test("an untouched theme keeps following the Original theme", () => {
    const s = settingsWith({ default: legacyDefault, christmas: { title: [photo(95)] } });
    expect(s.media.christmas?.sections).toBeNull();
    const christmas = resolveMedia(s.media.christmas, fallbackMediaFor("christmas", s.media));
    expect(christmas.sections.map((x) => x.photos.map((p) => p.id))).toEqual([["photo-1", "photo-2", "photo-3"], ["photo-4", "photo-5", "photo-6"], ["photo-7", "photo-8", "photo-9"]]);
  });

  test("a partly changed theme fills its empty spots from the Original theme, as before", () => {
    const s = settingsWith({
      default: legacyDefault,
      christmas: { groups: [{ photos: [null, photo(30), null], title: "Merry", text: null }] },
    });
    const own = s.media.christmas?.sections;
    expect(own?.map((x) => x.photos.map((p) => p.id))).toEqual([["photo-1", "photo-30", "photo-3"], ["photo-4", "photo-5", "photo-6"], ["photo-7", "photo-8", "photo-9"]]);
    expect(own?.[0]).toMatchObject({ title: "Merry", text: en.home.portfolio.prompts[0].text });
    expect(own?.[1].title).toBe("Want to save this memory?");
  });

  test("nothing changed at all = the built-in sections", () => {
    const r = resolveMedia(settingsWith({ default: { title: [photo(90)] } }).media.default);
    expect(r.sections.map((x) => x.prompt?.title)).toEqual(en.home.portfolio.prompts.map((p) => p.title));
    expect(r.sections.flatMap((x) => x.photos)).toEqual(portfolio.slice(0, 9));
    expect(resolveMedia(undefined, undefined, "es").sections.map((x) => x.prompt?.title)).toEqual(es.home.portfolio.prompts.map((p) => p.title));
  });
});

describe("sections", () => {
  const media = (sections: MediaSection[], landingPicks: string[] = []) => ({ ...emptyThemeMedia(), title: [photo(90), photo(91)], sections, landingPicks });

  test("the box can be switched off and can show any picture of its section", () => {
    const r = resolveMedia(media([
      section("a", photos(1, 5), { promptPhotoId: "photo-4" }),
      section("b", photos(6, 2), { prompt: false }),
      section("c", photos(8, 1)),
      section("empty", []),
    ]));
    expect(feedShape(buildFeedFromMedia(r))).toEqual([
      ["photo-1", "photo-2", "photo-3"], ["photo-4", "photo-5"], "box:photo-4:a title|a text",
      ["photo-6", "photo-7"],
      ["photo-8"], "box:photo-8:c title|c text",
    ]);
  });

  test("a new section's box picture is the one a parent books with (the booking pages can find it, in both languages)", () => {
    const list = [section("a", photos(1, 3)), section("new", photos(4, 4), { promptPhotoId: "photo-6" })];
    for (const locale of ["en", "es"] as const) {
      const r = resolveMedia(media(list), undefined, locale);
      const box = buildFeedFromMedia(r).filter((b) => b.type === "cta").at(-1);
      expect(box?.type === "cta" && box.photo.id).toBe("photo-6");
      // the booking pages look the picked picture up among these (findPhoto)
      expect(feedPhotos(r).find((p) => p.id === "photo-6")?.title).toBe(locale === "en" ? "Photo 6" : "Foto 6");
    }
  });

  test("the landing page shows the picked pictures (feed order), else the first 6 that aren't title photos", () => {
    const list = [section("a", [photo(90), ...photos(1, 4)]), section("b", photos(5, 6))];
    expect(resolveMedia(media(list)).gallery.map((p) => p.id)).toEqual(["photo-1", "photo-2", "photo-3", "photo-4", "photo-5", "photo-6"]);
    expect(resolveMedia(media(list, ["photo-9", "photo-2"])).gallery.map((p) => p.id)).toEqual(["photo-2", "photo-9"]);
  });

  test("Spanish pages leave out pictures and boxes without Spanish copy", () => {
    const r = resolveMedia(media([section("a", [photo(1), photo(2, false)], { spanish: null }), section("b", photos(3, 3))]), undefined, "es");
    expect(r.sections[0]).toEqual({ photos: [{ ...photo(1), ...photo(1).spanish }], prompt: null });
    expect(r.sections[1].prompt).toMatchObject({ title: "b título", text: "b texto" });
  });

  test("an open box without Spanish wording hides the Spanish site; a closed one doesn't", () => {
    const issues = (list: MediaSection[]) => spanishOwnerCopyIssues({ ...defaultSettings, media: { default: media(list) } } as SiteSettings);
    expect(issues([section("a", photos(1, 3), { spanish: null })])).toEqual(["Spanish gallery prompt copy"]);
    expect(issues([section("a", photos(1, 3), { spanish: null, prompt: false })])).toEqual([]);
  });

  test("parsing keeps limits, unique picture ids and only known landing picks; a box needs its wording", () => {
    const parse = (sections: unknown[], landingPicks: unknown[] = []) => settingsWith({ default: { sections, landingPicks } }).media.default!;
    const m = parse([section("a", [photo(1), photo(1)]), section("a", photos(2, 2), { title: "", prompt: true })], ["photo-2", "nope", "photo-2"]);
    expect(m.sections?.map((x) => x.id)).toEqual(["a", "a-2"]);
    expect(m.sections?.[0].photos.map((p) => p.id)).toEqual(["photo-1", "photo-1-1-2"]);
    expect(m.sections?.[1].prompt).toBe(false);
    expect(m.landingPicks).toEqual(["photo-2"]);
    expect(() => parse(Array.from({ length: 11 }, (_, i) => section(`s${i}`, [])))).toThrow(SettingsInputError);
    expect(() => parse([section("a", photos(1, 13))])).toThrow(SettingsInputError);
    const eight = [section("x", photos(1, 4)), section("y", photos(5, 4))];
    expect(parse(eight, photos(1, 8).map((p) => p.id)).landingPicks).toEqual(photos(1, 6).map((p) => p.id));
  });

  test("the stored file round-trips and also carries the older fields for a revert", () => {
    const s = settingsWith({ default: { sections: [section("a", photos(1, 5)), section("b", photos(6, 1), { prompt: false }), section("c", photos(7, 3)), section("d", photos(10, 2))], landingPicks: ["photo-3"] } });
    const stored = JSON.parse(JSON.stringify(storedSettings(s)));
    expect(parseSettings(stored)).toEqual(s);
    const older = stored.media.default;
    expect(older.groups.map((g: { photos: (PortfolioPhoto | null)[] }) => g.photos.map((p) => p?.id ?? null))).toEqual([["photo-1", "photo-2", "photo-3"], ["photo-6", null, null], ["photo-7", "photo-8", "photo-9"]]);
    expect(older.extra.map((p: PortfolioPhoto) => p.id)).toEqual(["photo-4", "photo-5", "photo-10", "photo-11"]);
    // a theme that follows the Original theme stays that way
    const following = parseSettings(JSON.parse(JSON.stringify(storedSettings(settingsWith({ default: { sections: [] }, christmas: { sections: null } })))));
    expect(following.media.christmas?.sections).toBeNull();
  });
});
