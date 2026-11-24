import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { RequestConfirmed, RequestListItem } from "@/lib/requests/types";
import { signedInAdmin } from "./fixtures/admin";

/**
 * /admin → Requests (brief 02, part 2): what families sent from /book, with Text, Confirm & send pay link, Other time
 * and Decline. APIs faked (the real confirm is checked against scripts/local-db + fake Outlook, Stripe and Resend).
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAY = "http://localhost:3100/book?bundle=our-little-story&deposit=TH-20261121-4459&k=sig";

const item = (over: Partial<RequestListItem>): RequestListItem => ({
  id: "00000000-0000-4000-8000-000000000001",
  reference: "TH-R-20261114-1234",
  propIdeas: null,
  createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  locale: "en",
  type: "date",
  status: "new",
  bundleId: "our-little-story",
  bundleName: "Our Little Story",
  babyCount: 1,
  totalCents: 26910,
  travelStatus: "free",
  travelMiles: 4,
  travelFeeCents: 0,
  slotDate: "2026-11-21",
  slotStart: "09:00",
  dueDate: null,
  holdUntil: new Date(Date.now() + (11 * 60 + 52) * 60_000 + 30_000).toISOString(),
  firstName: "Ana",
  mobile: "(305) 555-0142",
  email: "ana@example.com",
  zip: "33139",
  textConsent: true,
  made: null,
  hello: "Hi Ana! This is Tiny Humans about your session request for Saturday, November 21, 2026, 9:00 am.",
  link: null,
  ...over,
});

test("Requests: each new request with its hold; Text, Confirm (pay link text), Other time, Decline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "One browser covers the owner area");
  await signedInAdmin(page);
  const ana = item({});
  const lucia = item({ id: "00000000-0000-4000-8000-000000000002", reference: "TH-R-20261114-5678", locale: "es", type: "due_date", slotDate: null, slotStart: null, holdUntil: null, dueDate: "2026-12-20", firstName: "Lucía", mobile: "(786) 555-0199", email: "lucia@example.com", textConsent: false, babyCount: 2, totalCents: 34410, travelStatus: "fee", travelMiles: 38, travelFeeCents: 2500, hello: "¡Hola Lucía! Te escribe Tiny Humans sobre tu solicitud." });
  let list = [ana, lucia];
  const posted: { action: string; id: string; slot?: { date: string; start: string }; email?: boolean }[] = [];
  await page.route("**/api/admin/requests", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { requests: list } });
    const body = route.request().postDataJSON() as { action: string; id: string; slot?: { date: string; start: string }; email?: boolean };
    posted.push(body);
    if (body.action === "delete") {
      list = list.filter((r) => r.id !== body.id);
      return route.fulfill({ json: { deleted: true } });
    }
    if (body.action === "decline") {
      list = list.map((r) => (r.id === body.id ? { ...r, status: "declined" } : r));
      return route.fulfill({ json: { emailed: true } });
    }
    const done: RequestConfirmed = { reference: body.slot ? "TH-20261127-1111" : "TH-20261121-4459", kind: "booking", status: "pending", url: PAY, holdUntil: new Date(Date.now() + 48 * 3_600_000).toISOString(), sms: `Hi Ana, you're confirmed for Saturday, November 21, 2026, 9:00 am. Here's the link to hold it with the $50 deposit: ${PAY}`, emailed: true };
    return route.fulfill({ status: 201, json: done });
  });
  await page.route("**/api/admin/booking/slots?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    const days = [];
    for (let d = new Date(`${q.get("from")}T12:00:00Z`); d <= new Date(`${q.get("to")}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
      const date = d.toISOString().slice(0, 10);
      days.push({ date, slots: d.getUTCDay() === 0 ? [] : [{ id: `${date}T13:00`, date, start: "13:00", end: "15:00", label: "1:00 PM" }] });
    }
    return route.fulfill({ json: { days } });
  });

  await page.goto("/admin/requests");
  await expect(page.getByRole("navigation", { name: "Owner area" }).getByRole("link", { name: "Requests" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "2 new" })).toBeVisible();
  const cards = page.getByRole("list", { name: "New requests" }).getByRole("listitem");
  const first = cards.filter({ hasText: "Ana" });
  await expect(first).toContainText("Saturday, November 21, 2026 · 9:00 am");
  await expect(first).toContainText("Our Little Story · $269.10 · ZIP 33139, travel free (4 mi)");
  await expect(first).toContainText("OK to text: yes");
  await expect(first).toContainText("sent 4 min ago");
  await expect(first).toContainText("Held for them 11 h 52 min more.");
  const second = cards.filter({ hasText: "Lucía" });
  await expect(second).toContainText("Due date: Sunday, December 20, 2026");
  await expect(second).toContainText("twins · $369.10 · ZIP 33139, travel +$25 (38 mi)");
  await expect(second).toContainText("Spanish");
  await expect(second).not.toContainText("Held for them");

  // Text: Messages with a hello in their language
  const hello = await first.getByRole("link", { name: "Text Ana" }).getAttribute("href");
  expect(hello).toBe(`sms:+13055550142?&body=${encodeURIComponent(ana.hello)}`);

  const scan = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(scan.violations).toEqual([]);

  // Confirm & send pay link: booked through the owner path; the text carries the pay link
  await first.getByRole("button", { name: "Confirm & send pay link" }).click();
  await expect(first.getByRole("status")).toContainText("✓ TH-20261121-4459: time held until");
  await expect(first.getByRole("status")).toContainText("We emailed them the link.");
  const text = await first.getByRole("link", { name: "Text Ana the link" }).getAttribute("href");
  expect(decodeURIComponent(text!.split("body=")[1])).toContain(`deposit: ${PAY}`);
  expect(posted.at(-1)).toEqual({ action: "confirm", id: ana.id });

  // Other time: the owner's calendar for their bundle and ZIP; the picked time is booked instead
  await second.getByRole("button", { name: "Other time" }).click();
  const grid = second.getByRole("grid");
  await expect(grid).toHaveAttribute("aria-busy", "false");
  await grid.locator("button:not([disabled])").first().click();
  await second.getByRole("button", { name: "Book 1:00 pm" }).click();
  await expect(second.getByRole("status")).toContainText("✓ TH-20261127-1111");
  expect(posted.at(-1)).toMatchObject({ action: "confirm", id: lucia.id, slot: { start: "13:00" } });

  // Decline: a dialog, optionally with the polite email; the request moves to Answered
  list = [item({ id: "00000000-0000-4000-8000-000000000003", reference: "TH-R-20261114-9012", firstName: "Sofía" })];
  await page.reload();
  const sofia = page.getByRole("list", { name: "New requests" }).getByRole("listitem").filter({ hasText: "Sofía" });
  await sofia.getByRole("button", { name: "Decline" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Decline Sofía's request?" });
  await expect(dialog).toContainText("Their time is released for other families");
  await dialog.getByRole("button", { name: "Decline and email them" }).click();
  await expect.poll(() => posted.at(-1)).toEqual({ action: "decline", id: "00000000-0000-4000-8000-000000000003", email: true });
  await expect(page.getByRole("heading", { name: "Nothing new" })).toBeVisible();
  await page.getByRole("button", { name: "Show answered requests (1)" }).click();
  await expect(page.getByRole("list", { name: "Answered requests" })).toContainText("Declined");

  // Delete (owner, Nov 14: tests): for good, answered ones too
  await page.getByRole("list", { name: "Answered requests" }).getByRole("button", { name: "Delete" }).click();
  const confirmDelete = page.getByRole("alertdialog", { name: "Delete Sofía's request for good?" });
  await expect(confirmDelete).toContainText("can't be brought back");
  await confirmDelete.getByRole("button", { name: "Delete for good" }).click();
  expect(posted.at(-1)).toEqual({ action: "delete", id: "00000000-0000-4000-8000-000000000003" });
  await expect(page.getByText("No requests yet.")).toBeVisible();
});
