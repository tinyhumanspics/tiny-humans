import { expect, test, type Page } from "@playwright/test";
import es from "@/messages/es.json";

/** Board drawings (sun, hearts, stars) that sit on a heading's letters, or a heading doodle left alone on its own line. */
async function doodlesOnLetters(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hits: string[] = [];
    document.querySelectorAll("h1, h2").forEach((heading) => {
      let layer: Element | null = null;
      for (let el = heading.parentElement, i = 0; el && i < 3 && !layer; el = el.parentElement, i++) {
        layer = el.querySelector(":scope > div.chalk-grain[aria-hidden=true]");
      }
      if (!layer) return;
      // Letter zones: the middle of each line box (line-height padding and ascender space don't count).
      const letters: { left: number; right: number; top: number; bottom: number }[] = [];
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          letters.push({ left: box.left, right: box.right, top: box.top + box.height * 0.22, bottom: box.bottom - box.height * 0.18 });
        }
      }
      const label = heading.textContent?.trim().slice(0, 40);
      // the layer holds one box (the drawing area) with the drawings in it
      [...layer.querySelectorAll(":scope > div > span")].forEach((drawing, index) => {
        const raw = drawing.getBoundingClientRect();
        if (!raw.width || getComputedStyle(drawing).display === "none") return;
        const inset = raw.width * 0.12; // a drawing doesn't fill its square
        const box = { left: raw.left + inset, right: raw.right - inset, top: raw.top + inset, bottom: raw.bottom - inset };
        if (letters.some((l) => box.left < l.right && box.right > l.left && box.top < l.bottom && box.bottom > l.top)) {
          hits.push(`"${label}" drawing #${index}`);
        }
      });
      const own = heading.querySelector(":is(h1, h2) > span > svg");
      const lastLine = letters.at(-1);
      if (own && lastLine && own.getBoundingClientRect().left < lastLine.right - 4) hits.push(`"${label}" doodle wrapped away from its word`);
    });
    return hits;
  });
}

test.describe("chalk drawings stay off heading letters", () => {
  test("English pages at phone, tablet and desktop widths", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One Chromium pass over every width is enough.");
    for (const width of [320, 360, 390, 412, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/bundles", "/about", "/home-sweet-home"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        expect(await doodlesOnLetters(page), `${path} at ${width}px`).toEqual([]);
      }
    }
  });

  test("Spanish landing titles at phone widths", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One Chromium pass over every width is enough.");
    // Spanish routes are gated off in the isolated test build: put the real Spanish titles into the English headings.
    const titles: [string, string][] = [
      ["landing-portfolio", es.landing.portfolio.title],
      ["landing-how", es.landing.how.title],
      ["landing-bundles", es.landing.offer.title],
      ["landing-faq", es.landing.faq.title],
      ["landing-area", es.landing.area.title],
    ];
    for (const width of [320, 360, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/home-sweet-home", { waitUntil: "networkidle" });
      await page.evaluate((list) => {
        for (const [id, title] of list) {
          const heading = document.getElementById(id)!;
          const words = title.split(" ");
          const last = words.pop()!;
          heading.firstChild!.textContent = `${words.join(" ")} `;
          heading.querySelector(":scope > span")!.firstChild!.textContent = last;
        }
      }, titles);
      expect(await doodlesOnLetters(page), `Spanish landing titles at ${width}px`).toEqual([]);
    }
  });
});
