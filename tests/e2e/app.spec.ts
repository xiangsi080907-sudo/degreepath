import { test, expect } from "@playwright/test";
test("demo: explore official courses, audit, plan and what-if", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await page.screenshot({
    path: "docs/screenshots/landing.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: /Plan the path/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore demo" }).first().click();
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your next chapter, mapped out." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/overview.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Course explorer", exact: true })
    .click();
  await page.getByPlaceholder("Course code or title").fill("CSE 311");
  await page.locator(".course-card").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Course connections", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Required prerequisites", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/prerequisites.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Degree audit", exact: true }).click();
  await expect(
    page.getByText("Planning audit · verification incomplete"),
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
  await expect(
    page.getByText("Partial course plan · graduation not established"),
  ).toBeVisible();
  await expect(page.locator(".term-card")).not.toHaveCount(0);
  await page
    .getByRole("link", { name: "What-if planner", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove CSE 311", exact: true })
    .click();
  await expect(page.getByText("Impact & repair options")).toBeVisible();
  await expect(page.getByText(/Complete CSE 311/).first()).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/what-if.png",
    fullPage: true,
  });
});
test("account onboarding, saved plan persistence, ownership and sign in/out", async ({
  page,
  browser,
}) => {
  const email = `degreepath-e2e-${Date.now()}@example.com`;
  const password = "DegreePath-test-password-42";
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Test Student");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("STEP 1 OF 6")).toBeVisible();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const id of ["CSE 123", "MATH 124", "MATH 125", "MATH 126"]) {
    await page.getByPlaceholder("Search CSE 123, calculus…").fill(id);
    await page.getByLabel("Select course", { exact: true }).selectOption(id);
    await page.getByLabel("Grade (optional)", { exact: true }).fill("3.5");
    await page.getByRole("button", { name: "Add course", exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate my plan", exact: true })
    .click();
  await expect(
    page.getByText("Three planning strategies compared"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Degree audit", exact: true }).click();
  await expect(
    page.getByText("Computer Science fundamentals", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Course explorer", exact: true })
    .click();
  await page.getByPlaceholder("Course code or title").fill("CSE 311");
  await page.locator(".course-card").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close course detail" }).click();
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
  await page
    .getByRole("link", { name: "What-if planner", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove CSE 311", exact: true })
    .click();
  await expect(page.getByText("Impact & repair options")).toBeVisible();
  await page
    .getByRole("button", { name: "Regenerate & repair", exact: true })
    .click();
  await expect(
    page.getByText("Three planning strategies compared"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByText("Plan saved to your account")).toBeVisible();
  const response = await page.request.get("/api/state");
  const state = await response.json();
  expect(state.state.courses).toHaveLength(4);
  const savedId = state.plans[0].id;
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/register");
  await otherPage.getByLabel("Name", { exact: true }).fill("Other Student");
  await otherPage.getByLabel("Email", { exact: true }).fill(`other-${email}`);
  await otherPage.getByLabel("Password", { exact: true }).fill(password);
  await otherPage.getByRole("button", { name: "Create account" }).click();
  await expect(otherPage.getByText("STEP 1 OF 6")).toBeVisible();
  const forbidden = await otherPage.request.get(`/api/plans?id=${savedId}`);
  expect(forbidden.status()).toBe(404);
  const deleteResult = await otherPage.request.delete("/api/plans", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { id: savedId },
  });
  expect((await deleteResult.json()).deleted).toBe(0);
  expect((await page.request.get(`/api/plans?id=${savedId}`)).status()).toBe(
    200,
  );
  const majorAttack = await otherPage.request.patch("/api/state", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {
      userId: state.userId ?? "victim",
      programCatalogId: "uw-seattle-business:uw-seattle-business-2026-09",
    },
  });
  expect(majorAttack.status()).toBe(400);
  expect(
    (await (await page.request.get("/api/state")).json()).state
      .programCatalogId,
  ).toBe(state.state.programCatalogId);
  await other.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/app");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your next chapter, mapped out." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await expect(page.locator(".record-row")).toHaveCount(4);
  await page
    .getByRole("link", { name: "Degree plan", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved plans", exact: true }),
  ).toBeVisible();
  await page.locator(".saved-row").first().click();
  await expect(
    page.getByText("Loaded saved snapshot. Current course history may differ."),
  ).toBeVisible();
});
test("protected endpoints and origin validation", async ({ request }) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.get("/api/plans?id=anything")).status()).toBe(401);
  expect((await request.post("/api/generate", { data: {} })).status()).toBe(
    403,
  );
});
test("responsive demo has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Your next chapter, mapped out." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page
    .getByRole("link", { name: "Course explorer", exact: true })
    .click();
  await expect(page.getByPlaceholder("Course code or title")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile-explorer.png",
    fullPage: true,
  });
});
