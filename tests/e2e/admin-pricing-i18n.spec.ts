import { expect, test } from "@playwright/test";
import type { AdminBundle } from "@/config/bundles";
import { defaultSettings } from "@/lib/settings/defaults";
import type { BundleInput } from "@/lib/pricing/validation";

const bundle: AdminBundle = {
  id: "little-moments",
  name: "Little Moments",
  price: 149,
  description: "A simple first session",
  duration: "Up to 1 hour",
  durationMinutes: 60,
  people: "",
  setups: "",
  photos: "8",
  features: ["Up to 1 hour", "8 edited digital photos"],
  locationNote: "We bring the studio to your home",
  cta: "Choose Little Moments",
  badge: "Most loved",
  active: true,
  sortOrder: 0,
  offer: null,
  extraBaby: { active: true, price: 75, extraMinutes: 30, extraPhotos: 5, maxBabies: 3 },
  spanish: null,
};

test("the owner can save every Spanish bundle-copy field", async ({ page }, testInfo) => {
  const visualCapture = process.env.CAPTURE_ADMIN_I18N === "1";
  test.skip(visualCapture ? testInfo.project.name === "android-chrome" : testInfo.project.name !== "desktop-chrome", "The owner form only needs desktop regression coverage; visual QA also captures iPhone");
  const capture: { saved?: BundleInput } = {};

  await page.route("**/api/admin/session", (route) => route.fulfill({ json: { authenticated: true, authConfigured: true, storageConfigured: true } }));
  await page.route("**/api/admin/settings", (route) => route.fulfill({ json: defaultSettings }));
  await page.route("**/api/admin/deposit", (route) => route.fulfill({ json: { settings: null, stripeReady: true, databaseConfigured: true } }));
  await page.route("**/api/admin/pricing", (route) => route.fulfill({ json: { bundles: [bundle], codes: [], databaseConfigured: true } }));
  await page.route("**/api/admin/pricing/bundles", async (route) => {
    capture.saved = route.request().postDataJSON() as BundleInput;
    await route.fulfill({ json: { bundles: [{ ...bundle, spanish: capture.saved.spanish }] } });
  });

  await page.goto("/admin/pricing");
  await expect(page.getByText("Spanish website copy: not added yet")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Bundle name (Spanish)").fill("Pequeños Momentos");
  await page.getByLabel(/Small label \(Spanish\)/).fill("El favorito");
  await page.getByLabel(/Description \(Spanish\)/).fill("Una primera sesión sencilla");
  await page.getByLabel("Included item 1 (Spanish)").fill("Hasta 1 hora");
  await page.getByLabel("Included item 2 (Spanish)").fill("8 fotos digitales editadas");
  if (visualCapture) await page.screenshot({ path: `.screenshots/admin-pricing-spanish/${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Save bundle" }).click();

  await expect(page.getByText("Little Moments saved. It's live on the website.")).toBeVisible();
  expect(capture.saved?.spanish).toEqual({
    name: "Pequeños Momentos",
    description: "Una primera sesión sencilla",
    badge: "El favorito",
    offerLabel: null,
    features: ["Hasta 1 hora", "8 fotos digitales editadas"],
  });
});
