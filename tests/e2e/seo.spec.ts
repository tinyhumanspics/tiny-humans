import { expect, test } from "@playwright/test";

const ORIGIN = "https://www.tinyhumans.photography";

test("public pages publish unique canonical and social URLs", async ({ page }) => {
  for (const path of ["/", "/about", "/bundles", "/home-sweet-home", "/privacy", "/terms"]) {
    await page.goto(path);
    const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "");
    const openGraph = new URL((await page.locator('meta[property="og:url"]').getAttribute("content")) ?? "");
    expect({ origin: canonical.origin, path: canonical.pathname }).toEqual({ origin: ORIGIN, path });
    expect({ origin: openGraph.origin, path: openGraph.pathname }).toEqual({ origin: ORIGIN, path });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${ORIGIN}/og/tiny-humans-og.jpg`);
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(0);
  }
});

test("home page publishes honest service-area business JSON-LD", async ({ page }) => {
  await page.goto("/");
  const content = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(content ?? "null");
  expect(data).toMatchObject({
    "@type": "ProfessionalService",
    name: "Tiny Humans",
    url: `${ORIGIN}/`,
    telephone: "+17862227194",
    address: { addressLocality: "Miami Beach", addressRegion: "FL", addressCountry: "US" },
  });
  expect(data.areaServed.map((place: { name: string }) => place.name)).toEqual(expect.arrayContaining(["Miami Beach", "Orlando"]));
  expect(data).not.toHaveProperty("aggregateRating");
  expect(data).not.toHaveProperty("review");
});

test("sitemap includes only canonical public content pages", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  for (const path of ["/", "/about", "/bundles", "/home-sweet-home", "/privacy", "/terms"]) {
    expect(body).toContain(`<loc>${ORIGIN}${path === "/" ? "/" : path}</loc>`);
  }
  expect(body).not.toContain("/admin");
  expect(body).not.toContain("/api/");
  expect(body).not.toContain("/book");
  expect(body).not.toContain("/es");
});

test("Spanish stays completely unpublished until the live readiness gate passes", async ({ page }) => {
  const response = await page.goto("/es");
  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Language" })).toHaveCount(0);
});

test("robots points crawlers to the sitemap and keeps private infrastructure out", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  expect(body).toContain("Disallow: /admin");
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Disallow: /pay");
});

test("the query-driven booking page is not indexed", async ({ page }) => {
  await page.goto("/book?bundle=little-moments");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}/book`);
});
