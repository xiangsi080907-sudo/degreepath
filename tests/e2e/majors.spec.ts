import { test, expect, type Page } from "@playwright/test";
const cs = "uw-seattle-cs:uw-seattle-current-2026-09";
const business = "uw-seattle-business:uw-seattle-business-2026-09";
const headers = { Origin: "http://127.0.0.1:3000" };
async function change(page: Page, major: string) {
  const details = page.locator("details").filter({ hasText: "Active major:" });
  if (!(await details.getAttribute("open"))) {
    if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
      await details.locator("summary").click();
  }
  await details.getByRole("radio", { name: new RegExp(`^${major}`) }).check();
  await details
    .getByRole("button", { name: `Switch to ${major}`, exact: true })
    .click();
  await expect(
    page.getByText(`Switched to ${major}.`, { exact: false }),
  ).toBeVisible();
}
test("Business onboarding, persistent selection, preserved history and cross-major snapshots", async ({
  page,
  browser,
}) => {
  const email = `major-${Date.now()}@example.com`;
  const password = "DegreePath-test-password-42";
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Major Student");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("STEP 1 OF 6")).toBeVisible();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: /^Business/ }).check();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const id of ["MATH 124", "ECON 200", "CSE 121"]) {
    await page.getByPlaceholder("Search CSE 123, calculus…").fill(id);
    await page.getByLabel("Select course", { exact: true }).selectOption(id);
    await page.getByRole("button", { name: "Add course", exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate my plan", exact: true })
    .click();
  await expect(
    page.getByText("Three planning strategies compared"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Degree plan", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByText("Plan saved to your account")).toBeVisible();
  const before = await (await page.request.get("/api/state")).json();
  expect(before.state.programCatalogId).toBe(business);
  expect(before.plans[0].config.programCatalogId).toBe(business);
  await change(page, "Computer Science");
  await page.getByRole("link", { name: "Degree audit", exact: true }).click();
  await expect(
    page.getByText("Computer Science fundamentals", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Degree plan", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Generate plans", exact: true })
    .click();
  await expect(
    page.getByText("Three planning strategies compared"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByText("Plan saved to your account")).toBeVisible();
  await change(page, "Business");
  await page
    .getByRole("button", { name: "Generate plans", exact: true })
    .click();
  await expect(
    page.getByText("Three planning strategies compared"),
  ).toBeVisible();
  await page
    .locator(".saved-row")
    .filter({ hasText: "Computer Science" })
    .click();
  await expect(
    page.getByText("This plan belongs to a different major.", { exact: false }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/state")).json();
  expect(after.state.courses).toEqual(before.state.courses);
  expect(
    after.plans
      .map(
        (p: { config: { programCatalogId: string } }) =>
          p.config.programCatalogId,
      )
      .sort(),
  ).toEqual([business, cs].sort());
  for (const payload of [
    { programCatalogId: "invalid" },
    { programCatalogId: cs, userId: "someone-else" },
  ]) {
    expect(
      (
        await page.request.patch("/api/state", { headers, data: payload })
      ).status(),
    ).toBe(400);
  }
  const other = await browser.newContext();
  expect(
    (
      await other.request.patch("http://127.0.0.1:3000/api/state", {
        headers,
        data: { programCatalogId: cs },
      })
    ).status(),
  ).toBe(401);
  await other.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Active major: Business", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Degree audit", exact: true }).click();
  await expect(
    page.getByText("Business foundations", { exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/state")).json()).state.courses,
  ).toEqual(before.state.courses);
});
test("mobile public demo switches majors and retains selection on reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await change(page, "Business");
  await page.reload();
  await expect(
    page.getByText("Active major: Business", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("summary").filter({ hasText: "Active major:" }).click();
  await page
    .getByRole("heading", { name: "Your next chapter, mapped out." })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile-business.png",
    fullPage: true,
  });
  await change(page, "Computer Science");
  await page.setViewportSize({ width: 1440, height: 960 });
  await change(page, "Business");
  await page.screenshot({
    path: "docs/screenshots/business.png",
    fullPage: true,
  });
});
