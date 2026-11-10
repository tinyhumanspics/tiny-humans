import { expect, test } from "@playwright/test";

/** Owner, Nov 10: Our Family Story asks who else is in the photos (up to 5, a role each, names optional). Mock provider. */

const availableDay = (page: import("@playwright/test").Page) =>
  page.locator('button[aria-label*="time available"], button[aria-label*="times available"]').first();

async function openDetails(page: import("@playwright/test").Page) {
  const loaded = page.waitForResponse((r) => r.url().includes("/api/booking/availability"));
  await page.goto("/book?bundle=forever-little");
  await loaded;
  await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  if (!(await availableDay(page).count())) {
    const next = page.waitForResponse((r) => r.url().includes("/api/booking/availability"));
    await page.getByRole("button", { name: "Next month" }).click();
    await next;
    await expect(page.locator('[role="grid"]')).toHaveAttribute("aria-busy", "false");
  }
  await availableDay(page).click();
  await page.getByRole("button", { name: /Next: Time/ }).click();
  await page.locator('label[for^="time-"]').first().click();
  await page.getByRole("button", { name: /Next: Details/ }).click();
  await expect(page.locator("#field-parentName")).toBeVisible();
}

test("Our Family Story: 5 people counting the baby, +$75 for each extra person (role required, names optional)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let submitted: { family?: unknown } | undefined;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/booking/create")) submitted = request.postDataJSON();
  });
  await openDetails(page);

  const family = page.getByRole("group", { name: "Who else is in the photos?" });
  await expect(family).toBeVisible();
  await expect(family.getByText("Your bundle includes up to 5 people in total, counting your baby. Names are optional. Each extra person is +$75.")).toBeVisible();

  await page.fill("#field-parentName", "Ana Morales");
  await page.fill("#field-email", "ana.family@example.com");
  await page.fill("#field-phone", "(305) 555-0177");
  await page.fill("#field-street", "1500 Bay Rd");
  await page.fill("#field-city", "Miami Beach");
  await page.fill("#field-zip", "33139");
  await page.selectOption("#field-babyAge", { index: 1 });

  // the first row needs a role before going on
  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(family.getByText("Choose who this is, or remove them.")).toBeVisible();
  await expect(page.locator("#field-family-0-role")).toBeFocused();

  const add = family.getByRole("button", { name: "+ Add a family member" });
  const roles = ["mom", "dad", "brother", "sister", "grandma"];
  for (const [i, role] of roles.entries()) {
    if (i > 0) {
      await add.click();
      await expect(page.locator(`#field-family-${i}-role`)).toBeFocused();
    }
    await page.selectOption(`#field-family-${i}-role`, role);
    // baby + 4 family = the 5 included people: no charge until the fifth family member
    await expect(family.getByText(/extra (person|people): \+/)).toHaveCount(i < 4 ? 0 : 1);
  }
  await page.fill("#field-family-0-name", "Ana");
  await page.fill("#field-family-2-name", "Leo");
  await expect(family.getByText("1 extra person: +$75")).toBeVisible();

  // up to 5 extra people (9 family members with one baby), then the add button gives way to a note
  for (let i = 5; i < 9; i++) await add.click();
  await expect(family.getByText("5 extra people: +$375")).toBeVisible();
  await expect(family.getByText("That's the most this bundle allows.")).toBeVisible();
  await expect(add).toHaveCount(0);
  for (let n = 9; n > 5; n--) await family.getByRole("button", { name: `Remove family member ${n}` }).click();
  await expect(family.getByRole("button", { name: "+ Add a family member" })).toBeFocused();

  await page.getByRole("button", { name: /Next: Review/ }).click();
  await expect(page.getByText("Check everything")).toBeVisible();
  const review = page.locator("dl");
  await expect(review.getByText("Mom (Ana), Dad, Brother (Leo), Sister, Grandma", { exact: true })).toBeVisible();
  await expect(review.getByText("Extra family member", { exact: true })).toBeVisible();
  await expect(review.getByText("1 × $75 = $75", { exact: true })).toBeVisible();
  await page.waitForTimeout(4500); // the server refuses bookings finished in under 4 seconds
  await page.getByRole("button", { name: /Book my session/ }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Mom (Ana), Dad, Brother (Leo), Sister, Grandma", { exact: true })).toBeVisible();
  // booking details + the payment summary below them
  await expect(page.getByText("Extra family member", { exact: true })).toHaveCount(2);
  expect(submitted?.family).toEqual([{ role: "mom", name: "Ana" }, { role: "dad" }, { role: "brother", name: "Leo" }, { role: "sister" }, { role: "grandma" }]);
  expect(errors).toEqual([]);
});
