import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import es from "@/messages/es.json";

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

test.describe("content security policy (report-only)", () => {
  test("pages send the policy and the report endpoint accepts reports", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One server-level check is enough.");
    const res = await request.get("/");
    const policy = res.headers()["content-security-policy-report-only"] ?? "";
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("report-uri /api/csp-report");
    expect(res.headers()["reporting-endpoints"]).toBe('csp="/api/csp-report"');
    expect(res.headers()["content-security-policy"]).toBe("frame-ancestors 'self'");
    const report = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify({ "csp-report": { "document-uri": "http://localhost/", "effective-directive": "img-src", "blocked-uri": "https://cdn.example/a.png" } }),
    });
    expect(report.status()).toBe(204);

    // Nothing the site itself loads may break the policy (the Meta Pixel is off in tests; production reports cover it).
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = seen;
      document.addEventListener("securitypolicyviolation", (e) => seen.push(`${e.effectiveDirective} ${e.blockedURI}`));
    });
    for (const path of ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/about", "/privacy", "/terms", "/cancel", "/reschedule", "/review", "/admin", "/no-such-page"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      if (path === "/") {
        await page.getByRole("button", { name: /Open photo 1 of/ }).click();
        await page.getByRole("button", { name: "Close photo viewer" }).click();
      }
      expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), path).toEqual([]);
    }
  });
});

test.describe("public API request size", () => {
  test("oversized bodies are refused before validation", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One server-level check is enough.");
    const quote = await request.post("/api/booking/quote", { data: { bundleId: "little-moments", code: "x".repeat(9000) } });
    expect(quote.status()).toBe(413);
    const booking = await request.post("/api/booking/create", { data: { notes: "x".repeat(70_000) } });
    expect(booking.status()).toBe(413);
    const normal = await request.post("/api/booking/quote", { data: { bundleId: "little-moments" } });
    expect(normal.status()).toBe(200);
  });
});

test.describe("manual accessibility regression checks", () => {
  test("a family can book using only the keyboard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "Chromium tabs to every control by default; one keyboard pass is enough.");
    /** Presses Tab until `target` has focus (fails if it can't be reached by keyboard). */
    const tabTo = async (target: Locator, max = 80) => {
      for (let i = 0; i < max; i++) {
        if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
        await page.keyboard.press("Tab");
      }
      throw new Error(`Not reachable with Tab: ${target}`);
    };
    const loaded = page.waitForResponse((response) => response.url().includes("/api/booking/availability"));
    await page.goto("/book?bundle=little-moments");
    await loaded;
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
    const openDay = page.locator('button[aria-label*="time available"], button[aria-label*="times available"]').first();
    if (!(await openDay.count())) {
      await tabTo(page.getByRole("button", { name: "Next month" }));
      await page.keyboard.press("Enter");
    }
    await tabTo(openDay);
    await page.keyboard.press("Enter");
    await tabTo(page.getByRole("button", { name: /Next: Time/ }));
    await page.keyboard.press("Enter");
    await tabTo(page.locator('input[name="time"]').first());
    await page.keyboard.press("Space");
    await tabTo(page.getByRole("button", { name: /Next: Details/ }));
    await page.keyboard.press("Enter");
    for (const [field, value] of [
      ["#field-parentName", "Kim Keyboard"],
      ["#field-email", "kim.keyboard@example.com"],
      ["#field-phone", "(305) 555-0142"],
      ["#field-street", "1500 Bay Rd"],
      ["#field-city", "Miami Beach"],
      ["#field-zip", "33139"],
    ]) {
      await tabTo(page.locator(field));
      await page.keyboard.type(value);
    }
    await tabTo(page.locator("#field-babyAge"));
    await page.keyboard.type("Newborn"); // type-ahead picks the option (arrow keys open the menu on macOS)
    await tabTo(page.getByRole("button", { name: /Next: Review/ }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Check everything")).toBeVisible();
    await page.waitForTimeout(4500); // the server refuses forms finished in under 4 seconds
    await tabTo(page.getByRole("button", { name: /Book my session/ }));
    await page.keyboard.press("Enter");
    await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  });

  test("every page has one main heading and no skipped heading levels", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "Heading structure is the same in every browser.");
    for (const path of ["/", "/bundles", "/book?bundle=little-moments", "/home-sweet-home", "/about", "/privacy", "/terms", "/cancel", "/reschedule", "/review"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((headings) =>
        headings.filter((h) => h.getClientRects().length).map((h) => Number(h.tagName[1])),
      );
      expect(levels.filter((level) => level === 1), `${path} main headings`).toHaveLength(1);
      expect(levels[0], `${path} starts with its main heading`).toBe(1);
      const skips = levels.filter((level, i) => i > 0 && level > levels[i - 1] + 1);
      expect(skips, `${path} skipped heading levels`).toEqual([]);
    }
  });

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

  test("the Spanish header fits narrow phones without horizontal scrolling", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "One narrow-viewport pass is enough.");
    // Spanish routes are gated off in the isolated test build: give the real header the Spanish labels and locale hook.
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate((labels) => {
      const header = document.querySelector("header")!;
      header.dataset.locale = "es";
      header.querySelectorAll("nav li > a > span.chalk-soft").forEach((label, index) => { label.textContent = labels[index]; });
    }, [es.header.portfolio, es.header.bundles, es.header.book]);
    for (const width of [320, 340, 351, 360, 374, 375, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const widths = await page.evaluate(() => {
        const circle = document.querySelector("header nav svg")!.getBoundingClientRect();
        return { page: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, circleRight: circle.right };
      });
      expect(widths.page, `Spanish header at ${width}px`).toBeLessThanOrEqual(widths.viewport + 1);
      expect(widths.circleRight, `Spanish Book circle at ${width}px`).toBeLessThanOrEqual(widths.viewport);
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
