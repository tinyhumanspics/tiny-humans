import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAGES = ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/about", "/privacy", "/terms", "/cancel", "/reschedule", "/review", "/admin"];

test.describe("automated WCAG 2.2 AA checks", () => {
  for (const path of PAGES) {
    test(`${path} has no automatically detectable violations`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chrome", "One Chromium scan per page is enough; manual keyboard and screen-reader checks are separate.");
      await page.goto(path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
      if (results.violations.length) {
        await testInfo.attach("accessibility-scan.json", {
          body: JSON.stringify(results.violations, null, 2),
          contentType: "application/json",
        });
      }
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("owner API request origin", () => {
  test("rejects cross-origin mutations before password handling", async ({ request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One server-level check is enough.");
    const hostile = await request.post("/api/admin/login", {
      headers: { origin: "https://tinyhumans.photography.evil.example" },
      data: { password: "not-the-password" },
    });
    expect(hostile.status()).toBe(403);

    const sameOrigin = await request.post("/api/admin/login", {
      headers: { origin: new URL(baseURL!).origin },
      data: { password: "not-the-password" },
    });
    expect(sameOrigin.status()).toBe(401);
  });
});

test.describe("manual accessibility regression checks", () => {
  test("keyboard focus is visible on the main journeys", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One keyboard pass is enough.");
    for (const path of ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/admin"]) {
      await page.goto(path);
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible();
      const indicator = await focused.evaluate((element) => {
        const style = getComputedStyle(element);
        return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), boxShadow: style.boxShadow };
      });
      expect(indicator.outlineStyle !== "none" && indicator.outlineWidth >= 2 || indicator.boxShadow !== "none").toBe(true);
    }
  });

  test("public pages reflow without horizontal scrolling at 320 CSS pixels", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One narrow-viewport pass is enough.");
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/about", "/privacy", "/terms"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const widths = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
          .flatMap((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || rect.left >= -1 && rect.right <= viewport + 1) return [];
            return [{ element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}.${[...element.classList].join(".")}`, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
          })
          .sort((a, b) => Math.max(-b.left, b.right - viewport) - Math.max(-a.left, a.right - viewport))
          .slice(0, 8);
        return { page: document.documentElement.scrollWidth, viewport, offenders };
      });
      expect(widths.page, `${path} is wider than its viewport: ${JSON.stringify(widths.offenders)}`).toBeLessThanOrEqual(widths.viewport + 1);
    }
  });

  test("standalone controls meet the 24px WCAG 2.2 minimum target size", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One target-size pass is enough.");
    for (const path of ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/admin"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const undersized = await page.locator("button, input:not([type=hidden]), select, textarea, summary, [role=button]").evaluateAll((elements) =>
        elements.flatMap((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return [];
          return rect.width < 24 || rect.height < 24 ? [{ tag: element.tagName, text: element.textContent?.trim().slice(0, 60), width: rect.width, height: rect.height }] : [];
        }),
      );
      expect(undersized, `${path} has undersized standalone controls`).toEqual([]);
    }
  });
});
