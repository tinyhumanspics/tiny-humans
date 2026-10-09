import { expect, test } from "@playwright/test";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { formatLongDate, formatTimeLabel } from "@/lib/booking/dates";
import { customerBabiesLabel, customerBackdropNames, customerPricingRows, emailChangePolicyText } from "@/lib/email/customer-format";
import type { PriceQuote } from "@/lib/pricing/engine";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { bundlesHref, scheduleHref } from "@/config/booking";
import { localePath } from "@/i18n/path";

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

function compareCatalogShape(left: unknown, right: unknown, path = "emails"): void {
  expect(Array.isArray(right), `${path} has the same kind`).toBe(Array.isArray(left));
  if (typeof left === "string") {
    expect(typeof right, `${path} is translated text`).toBe("string");
    expect(placeholders(right as string), `${path} keeps its placeholders`).toEqual(placeholders(left));
    return;
  }
  if (Array.isArray(left)) {
    expect(right, `${path} is an array`).toBeInstanceOf(Array);
    expect((right as unknown[]).length, `${path} keeps every item`).toBe(left.length);
    left.forEach((value, index) => compareCatalogShape(value, (right as unknown[])[index], `${path}.${index}`));
    return;
  }
  expect(right && typeof right === "object", `${path} is an object`).toBeTruthy();
  expect(Object.keys(right as object).sort(), `${path} keeps every key`).toEqual(Object.keys(left as object).sort());
  Object.entries(left as Record<string, unknown>).forEach(([key, value]) => compareCatalogShape(value, (right as Record<string, unknown>)[key], `${path}.${key}`));
}

test("Spanish customer-email messages match the English schema and placeholders", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Catalog validation only needs one Node project");
  compareCatalogShape(en.emails, es.emails);
});

test("Spanish About messages match the English schema", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Catalog validation only needs one Node project");
  compareCatalogShape(en.about, es.about, "about");
});

test("Spanish public shell messages match the English schema", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Catalog validation only needs one Node project");
  compareCatalogShape(en.header, es.header, "header");
  compareCatalogShape(en.footer, es.footer, "footer");
});

test("public paths keep English unprefixed and put Spanish under /es", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Path validation only needs one Node project");
  expect(localePath("/about", "en")).toBe("/about");
  expect(localePath("/about", "es")).toBe("/es/about");
  expect(localePath("/", "es")).toBe("/es");
  expect(localePath("/#portfolio", "es")).toBe("/es/#portfolio");
  expect(bundlesHref("photo-1", "es")).toBe("/es/bundles?inspiration=photo-1");
  expect(scheduleHref("little-moments", "photo-1", "es")).toBe("/es/book?bundle=little-moments&inspiration=photo-1");
});

test("booking requests accept only supported customer languages", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Schema validation only needs one Node project");
  const base = {
    bundleId: "little-moments",
    slot: { date: "2026-12-05", start: "10:00" },
    contact: { parentName: "Ada Parent", email: "ada@example.com", phone: "3055550123", babyAge: "Newborn (0–2 weeks)" },
    address: { street: "123 Palm Ave", city: "Miami Beach", zip: "33139" },
  };

  expect(bookingRequestSchema.safeParse({ ...base, locale: "en" }).success).toBe(true);
  expect(bookingRequestSchema.safeParse({ ...base, locale: "es" }).success).toBe(true);
  expect(bookingRequestSchema.safeParse({ ...base, locale: "fr" }).success).toBe(false);
});

test("Spanish customer-email formatting covers dates, babies, prices, backdrops and policy", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Formatting validation only needs one Node project");

  expect(formatLongDate("2026-12-05", "es")).toBe("sábado, 5 de diciembre de 2026");
  expect(formatTimeLabel("14:30", "es")).toBe("2:30 p. m.");
  expect(customerBabiesLabel([{ name: "Luna", age: "Newborn (0–2 weeks)" }, { age: "Not born yet" }], "es")).toBe("Luna (Recién nacido (0–2 semanas)), Bebé 2 (Aún no ha nacido)");
  expect(customerBackdropNames(["burgundy", "wooden"], "es")).toBe("Borgoña y Madera");
  expect(customerBackdropNames(["pink"], "en")).toBe("Pink");
  expect(customerBackdropNames(["pink"], "es")).toBe("Rosa");

  const quote: PriceQuote = {
    bundleId: "little-moments",
    bundleName: "Little Moments",
    regularCents: 14900,
    offerCents: null,
    offerLabel: null,
    offerEndsOn: null,
    discountCode: "BABY20",
    discountCents: 2980,
    finalCents: 11920,
    addons: [{ kind: "extra_baby", name: "Extra baby", quantity: 1, unitPriceCents: 7500, totalCents: 7500, extraMinutes: 30, extraPhotos: 5 }],
    addonsCents: 7500,
    totalCents: 19420,
    pricingType: "discount",
  };
  expect(customerPricingRows(quote, "es")).toEqual([
    ["Precio regular", "$149"],
    ["Código de descuento", "BABY20"],
    ["Descuento", "-$29.80"],
    ["Total del paquete", "$119.20"],
    ["Bebé adicional", "1 × $75 = $75"],
    ["Total de la sesión antes del viaje", "$194.20"],
  ]);
  expect(customerPricingRows(quote, "en").at(-2)?.[0]).toBe("Extra baby");
  expect(emailChangePolicyText(48, "es")).toContain("48 horas");
  expect(emailChangePolicyText(48, "es")).toContain("(786) 222-7194");
});
