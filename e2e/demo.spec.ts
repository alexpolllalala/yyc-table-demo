import { expect, test, type Page } from "@playwright/test";

async function startGuest(page: Page, lang = "English", cont = "Continue") {
  await page.goto("/#/guest/T7");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: lang }).first().click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: cont }).click();
}
const add = (page: Page, name: string) => page.locator("li", { hasText: name }).getByRole("button", { name: "Add" }).first().click();

test("guest orders at the table; kitchen, bar and waiter see it in other tabs; stages, payment, receipt", async ({ page, context }) => {
  await startGuest(page);
  await expect(page.locator("li img").first()).toBeVisible(); // food photos
  await add(page, "Buffalo Wings");
  await add(page, "Local Lager");
  await page.getByRole("button", { name: /View order/ }).click();
  await page.getByRole("button", { name: /^Pay at the table/ }).click();
  await expect(page.getByText("Waiting for the team").first()).toBeVisible();

  const kitchen = await context.newPage(); await kitchen.setViewportSize({ width: 1100, height: 800 }); await kitchen.goto("/#/kitchen");
  const bar = await context.newPage(); await bar.setViewportSize({ width: 1100, height: 800 }); await bar.goto("/#/bar");
  await expect(kitchen.getByText("1 × Buffalo Wings")).toBeVisible();
  await expect(bar.getByText("1 × Local Lager (pint)")).toBeVisible();
  await kitchen.getByRole("button", { name: "Accept" }).click();
  await bar.getByRole("button", { name: "Accept" }).click();

  const stage = async (p: number, text: string) => { await page.getByRole("button", { name: `${p}%`, exact: true }).click(); await expect(page.getByTestId("stage-message").first()).toContainText(text); };
  await stage(0, "accepted, the team is on it");
  await stage(30, "being prepared");
  await stage(70, "Almost there");
  await stage(95, "coming to your table");
  await stage(110, "Still cooking");

  await kitchen.getByRole("button", { name: "Ready" }).click();
  await bar.getByRole("button", { name: "Ready" }).click();
  const waiter = await context.newPage(); await waiter.setViewportSize({ width: 1100, height: 800 }); await waiter.goto("/#/waiter");
  await waiter.getByLabel("Waiter").selectOption("Jordan"); // T7 is in Jordan's section
  const ready = waiter.getByRole("region", { name: "Ready to serve" });
  await expect(ready).toBeVisible();
  for (let i = 0; i < 2; i++) await ready.getByRole("button", { name: "Served" }).first().click();
  await expect(waiter.getByRole("region", { name: "Served, waiting for payment" })).toBeVisible();

  // Guest pays with the (mock) test card and tips 15%.
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "15%" }).click();
  await page.getByRole("button", { name: /^Pay \$/ }).click();
  await expect(page.getByText("Stripe test checkout (demo)")).toBeVisible();
  await page.getByRole("button", { name: /^Pay \$/ }).click();
  await expect(page.getByText("Paid")).toBeVisible();
  await expect(page.getByText("GST (5%)")).toBeVisible();
});

test("pay now is held until paid; switching to pay at the table releases it", async ({ page, context }) => {
  await startGuest(page);
  await add(page, "Poutine");
  await page.getByRole("button", { name: /View order/ }).click();
  await page.getByRole("button", { name: /^Pay now/ }).click();
  await expect(page.getByText("Stripe test checkout")).toHaveCount(0);
  const kitchen = await context.newPage(); await kitchen.setViewportSize({ width: 1100, height: 800 }); await kitchen.goto("/#/kitchen");
  await expect(kitchen.getByText("1 × Poutine")).toHaveCount(0); // not released yet
  await page.getByRole("button", { name: "Pay at the table instead" }).click();
  await expect(kitchen.getByText("1 × Poutine")).toBeVisible();
});

test("admin: Happy Hour discounts beer for the guest and 86 greys out an item", async ({ page, context }) => {
  await startGuest(page);
  await expect(page.locator("li", { hasText: "Local Lager" })).toContainText("$8.50");
  const admin = await context.newPage(); await admin.setViewportSize({ width: 1100, height: 800 }); await admin.goto("/#/admin");
  await admin.getByRole("button", { name: /Happy Hour/ }).click();
  await admin.getByRole("button", { name: "86" }).first().click();
  await expect(page.locator("li", { hasText: "Local Lager" })).toContainText("$6.80");
  await expect(page.getByText("Sold out").first()).toBeVisible();
});

test("Arabic is right-to-left and no screen scrolls sideways at 360px", async ({ page }) => {
  await startGuest(page, "العربية", "متابعة");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("li", { hasText: "برجر كلاسيكي" })).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.locator("li", { hasText: "برجر كلاسيكي" }).getByRole("button", { name: "إضافة" }).click();
  await page.getByRole("button", { name: /عرض الطلب/ }).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("consent needs the terms box; nothing is pre-ticked", async ({ page }) => {
  await page.goto("/#/guest/T7");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "English" }).first().click();
  for (const box of await page.getByRole("checkbox").all()) await expect(box).not.toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
