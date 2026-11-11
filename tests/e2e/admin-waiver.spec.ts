import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { LeadList } from "@/lib/leads/types";
import { waiverFacts } from "@/lib/waiver/facts";
import { FAMILY_WAIVER_VERSION, waiverSnapshot, WAIVER_VERSION } from "@/lib/waiver/text";
import type { SignedWaiver, WaiverContext } from "@/lib/waiver/types";
import { decodeSignature } from "@/lib/waiver/validation";
import { noDepositLead, signedInAdmin } from "./fixtures/admin";

/** /admin → Leads → photo and video release: the iPad screen, the signed copy and the Leads buttons. APIs faked. */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const REF = "TH-20261103-4821";
const IPAD = { width: 820, height: 1180 };

const CONTEXT: WaiverContext = {
  reference: REF,
  status: "confirmed",
  parentName: "Maria Morales",
  children: [{ name: "Sofia", age: "Newborn (0–2 weeks)" }],
  sessionDate: "2026-11-16",
  locale: "en",
  signed: null,
  kind: "baby",
  family: [],
};

const SIGNED: SignedWaiver = {
  id: "5d6e7f80-1111-4222-8333-944455556666",
  status: "signed",
  signedAt: "2026-11-16T15:42:00.000Z",
  signerName: "Maria Morales",
  relationship: "parent",
  uses: { website: true, social: true, ads: false, bts: true, personal: false },
  firstNameOk: true,
  language: "en",
  revokedAt: null,
  kind: "baby",
  reference: REF,
  familyName: "Maria Morales",
  children: CONTEXT.children,
  sessionDate: "2026-11-16",
  version: WAIVER_VERSION,
  snapshot: waiverSnapshot("en", waiverFacts(CONTEXT, "en")),
  sha256: "a".repeat(64),
  signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  revokeNote: null,
  bookingExists: true,
};

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area (iPad size set per test)");
  await signedInAdmin(page);
});

async function fakeWaiver(page: Page, context: WaiverContext = CONTEXT) {
  const posted: Record<string, unknown>[] = [];
  await page.route("**/api/admin/waiver?*", (route) => route.fulfill({ json: { context } }));
  await page.route("**/api/admin/waiver", (route) => {
    posted.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { saved: { id: SIGNED.id, signedAt: SIGNED.signedAt } } });
  });
  return posted;
}

async function sign(page: Page, label = "Sign here with your finger") {
  const pad = page.getByRole("img", { name: label });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 120);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(box.x + 40 + i * 12, box.y + 120 + Math.sin(i / 3) * 40, { steps: 2 });
  await page.mouse.up();
}

test("the parent reads, chooses, signs and taps Done; the owners tap Next back to Leads", async ({ page }) => {
  await page.setViewportSize(IPAD);
  const posted = await fakeWaiver(page);
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: { leads: [], counts: { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0, completed: 0, not_paid: 0 }, total: 0, money: { paidThisMonthCents: 0, unpaidCount: 0 } } }));
  await page.goto(`/admin/waiver/${REF}`);

  await expect(page.getByRole("heading", { name: "Photo and video release", level: 1 })).toBeVisible();
  await expect(page.getByText("Your little one: Sofia · The Morales family · Mon, Nov 16")).toBeVisible();
  // nothing to wander into: no site menu, no admin menu, no footer
  await expect(page.getByRole("link", { name: "Portfolio" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Owner area" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);

  // Done says what's missing
  const done = page.getByRole("button", { name: "Done: keep our photos private" });
  await expect(done).toHaveAttribute("aria-disabled", "true");
  await done.click({ force: true }); // "not ready" for screen readers, but a tap still says what's missing
  await expect(page.getByText('To finish: your name, tick "I agree", your signature.')).toBeVisible();
  expect(posted).toEqual([]);

  await page.getByLabel("Our website and online portfolio (tinyhumans.photography)").check();
  await page.getByLabel("Ads for Tiny Humans on Instagram and Facebook").check();
  await page.getByLabel("OK to use Sofia's first name in captions").check();
  await page.getByLabel("Your full name").fill("Maria Morales");
  await page.getByLabel("I've read this and I agree.").check();
  await sign(page);
  await expect(page.getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-disabled", "false");

  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thank you, Maria!" })).toBeFocused();
  await expect(page.getByText("You're all set. Please hand the iPad back to Adri or Alo.")).toBeVisible();
  expect(posted).toHaveLength(1);
  const body = posted[0];
  expect(body).toMatchObject({
    reference: REF,
    version: WAIVER_VERSION,
    language: "en",
    uses: { website: true, social: false, ads: true, bts: false, personal: false },
    firstNameOk: true,
    signerName: "Maria Morales",
    relationship: "parent",
    agree: true,
  });
  expect(decodeSignature(String(body.signature))).not.toBeNull();

  await page.getByRole("button", { name: "Next →" }).click();
  await page.waitForURL("**/admin/leads");
  await expect(page.getByText(`Waiver saved for ${REF}. It's on the lead under Photo use.`)).toBeVisible();
});

test("Our Family Story gets the family release: everyone in the photos, their first names, its own version (owner, Nov 11)", async ({ page }) => {
  await page.setViewportSize(IPAD);
  const posted = await fakeWaiver(page, { ...CONTEXT, kind: "family", family: [{ role: "mom", name: "Maria" }, { role: "brother", name: "Leo" }, { role: "grandma" }] });
  await page.goto(`/admin/waiver/${REF}`);
  await expect(page.getByRole("heading", { name: "Family photo and video release", level: 1 })).toBeVisible();
  await expect(page.getByText("Your little one: Sofia · Also in the photos: Maria (Mom), Leo (Brother), Grandma · The Morales family · Mon, Nov 16")).toBeVisible();
  await expect(page.getByText("For the other people in the photos, I confirm that each adult agreed to this release", { exact: false })).toBeVisible();
  await page.getByLabel("Our website and online portfolio (tinyhumans.photography)").check();
  await page.getByLabel("OK to use first names in captions (Sofia, Maria and Leo)").check();
  await page.getByLabel("Your full name").fill("Maria Morales");
  await page.getByLabel("I've read this and I agree.").check();
  await sign(page);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thank you, Maria!" })).toBeFocused();
  expect(posted[0]).toMatchObject({ version: FAMILY_WAIVER_VERSION, firstNameOk: true, uses: { website: true, social: false, ads: false, bts: false, personal: false } });
  // Spanish too
  await page.goto(`/admin/waiver/${REF}`);
  await page.getByRole("button", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Autorización de fotos y videos familiares", level: 1 })).toBeVisible();
  await expect(page.getByText("Tu pequeño: Sofia · También en las fotos: Maria (Mamá), Leo (Hermano), Abuela · Familia Morales", { exact: false })).toBeVisible();
});

test("Español: the whole form switches; nothing ticked keeps photos private", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  const posted = await fakeWaiver(page);
  await page.goto(`/admin/waiver/${REF}`);
  await page.getByRole("button", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Autorización de fotos y videos", level: 1 })).toBeVisible();
  await expect(page.getByText("Tu pequeño: Sofia · Familia Morales", { exact: false })).toBeVisible();
  await page.getByLabel("Tu nombre completo").fill("María Morales");
  await page.getByText("Tutor legal", { exact: true }).click();
  await page.getByLabel("Lo leí y estoy de acuerdo.").check();
  await sign(page, "Firma aquí con tu dedo");
  await page.getByRole("button", { name: "Listo: mantener nuestras fotos privadas" }).click();
  await expect(page.getByRole("heading", { name: "¡Gracias, María!" })).toBeVisible();
  await expect(page.getByText("Entendido: tus fotos se quedan privadas.", { exact: false })).toBeVisible();
  expect(posted[0]).toMatchObject({ language: "es", relationship: "guardian", uses: { website: false, social: false, ads: false, bts: false, personal: false }, firstNameOk: false });
});

test("Cancel takes two taps and goes back to Leads without saving", async ({ page }) => {
  await page.setViewportSize(IPAD);
  const posted = await fakeWaiver(page);
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: { leads: [], counts: { all: 0, pending: 0, confirmed: 0, rescheduled: 0, cancelled: 0, completed: 0, not_paid: 0 }, total: 0, money: { paidThisMonthCents: 0, unpaidCount: 0 } } }));
  await page.goto(`/admin/waiver/${REF}`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/waiver/${REF}$`));
  await page.getByRole("button", { name: "Tap again to cancel" }).click();
  await page.waitForURL("**/admin/leads");
  expect(posted).toEqual([]);
});

test("the signed copy: ✓/✗ on every choice, the signature, when, version and language", async ({ page }) => {
  await page.route(`**/api/admin/waiver/${SIGNED.id}`, (route) => route.fulfill({ json: { waiver: SIGNED } }));
  await page.goto(`/admin/waiver/signed/${SIGNED.id}`);
  await expect(page.getByText("Signed waiver · Maria Morales")).toBeVisible();
  await expect(page.getByText(`${REF} · Website, IG + FB, BTS videos`)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Yes: Our website and online portfolio" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "No: Ads for Tiny Humans" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Yes: OK to use Sofia's first name" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Signature of Maria Morales" })).toBeVisible();
  await expect(page.getByText(`Nov 16, 2026, 10:42 AM (Miami time) · ${WAIVER_VERSION} · Signed in English`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  // read-only: nothing on the page can change it
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});

test("Leads: Waiver signature until signed, then ✓ Signed waiver + Sign a new waiver (owner, Nov 11)", async ({ page }) => {
  const signedLead = { ...noDepositLead, reference: "TH-20261008-SIGN", parentName: "Signed Family", waiver: { ...SIGNED } };
  const familyLead = { ...noDepositLead, reference: "TH-20261008-FAMS", parentName: "Family Story", bundleName: "Our Family Story", waiverKind: "family" as const };
  const familySigned = { ...noDepositLead, reference: "TH-20261008-FAMD", parentName: "Family Signed", waiverKind: "family" as const, waiver: { ...SIGNED, id: "6e7f8091-1111-4222-8333-944455556666", kind: "family" as const } };
  const cancelled = { ...noDepositLead, reference: "TH-20261008-GONE", parentName: "Cancelled Family", status: "cancelled" as const };
  const list: LeadList = { leads: [noDepositLead, signedLead, familyLead, familySigned, cancelled], counts: { all: 5, pending: 0, confirmed: 4, rescheduled: 0, cancelled: 1, completed: 0, not_paid: 0 }, total: 5, money: { paidThisMonthCents: 0, unpaidCount: 0 } };
  await page.route("**/api/admin/leads?*", (route) => route.fulfill({ json: list }));
  await page.goto("/admin/leads");

  // not signed yet: "Waiver signature" (Our Family Story: "Family waiver signature"); none on a cancelled booking
  await expect(page.getByRole("link", { name: "Waiver signature", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Waiver signature", exact: true })).toHaveAttribute("href", "/admin/waiver/TH-20261008-TEST");
  await expect(page.getByRole("link", { name: "Family waiver signature" })).toHaveAttribute("href", "/admin/waiver/TH-20261008-FAMS");
  // signed: the button becomes "✓ Signed waiver" (the signed copy), with "Sign a new waiver" next to it
  const signed = page.getByRole("listitem").filter({ hasText: "Signed Family" });
  await expect(signed.getByRole("link", { name: "✓ Signed waiver" })).toHaveAttribute("href", `/admin/waiver/signed/${SIGNED.id}`);
  await expect(signed.getByRole("link", { name: "Sign a new waiver" })).toHaveAttribute("href", "/admin/waiver/TH-20261008-SIGN");
  await expect(signed.getByText("Photo waiver signed ✓", { exact: false })).toContainText("Website, IG + FB, BTS videos");
  const fam = page.getByRole("listitem").filter({ hasText: "Family Signed" });
  await expect(fam.getByRole("link", { name: "✓ Signed family waiver" })).toBeVisible();
  await expect(fam.getByText("Family photo waiver signed ✓", { exact: false })).toBeVisible();

  await signed.getByRole("button", { name: "View details" }).click();
  await expect(signed.getByText(/Waiver signed .*: Website, IG \+ FB, BTS videos · first name OK/)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);
});
