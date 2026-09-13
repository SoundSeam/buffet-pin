import { expect, test, type BrowserContext } from "@playwright/test";

for (const width of [390, 768, 1440]) {
  test(`complete bilingual drinks catalog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/drinks");
    await expect(page.locator("main article")).toHaveCount(15);
    await expect(page.locator('main img[src*="/drinks/2026-09-13/"]')).toHaveCount(15);
    for (const article of await page.locator("main article").all()) {
      await article.scrollIntoViewIfNeeded();
      await expect.poll(() => article.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 900)).toBe(true);
    }
    await expect(page.getByText("Mangue tropicale et crème de noix de coco, sur une glace pilée.")).toBeVisible();
    await expect(page.getByText("Thé noir infusé à l’hibiscus, acidulé et floral.")).toBeVisible();
    await expect(page.getByText("Thé au jasmin et fruit de la passion, légèrement sucré et exotique.")).toBeVisible();
    await expect(page.getByTestId("drink-price")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Choisir la langue" }).click();
    await expect(page.getByRole("heading", { name: "Mango Coconut Refresher", exact: true })).toBeVisible();
    await expect(page.getByText("Tropical mango and coconut cream over crushed ice.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Oasis Apple Juice", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `test-results/drinks-catalog-${width}.png`, fullPage: true, animations: "disabled" });
    await page.locator('nav a[aria-label="Buffet PIN"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).not.toHaveCSS("background-color", "rgb(2, 3, 5)");
  });
}

async function signIn(context: BrowserContext) {
  const payload = Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: "test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "11111111-1111-4111-8111-111111111111", email: "reservation-admin@example.test" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "localhost", path: "/" }]);
}

test("admin title/price edits, recovery, visibility and live public reflection", async ({ page, context }) => {
  test.skip(!!process.env.DRINKS_TEST_URL, "Never mutate production from browser tests");
  await signIn(context);
  await page.goto("/admin/drinks");
  const row = page.getByRole("form", { name: "Coke", exact: true });
  await expect(row).toBeVisible();
  await row.getByLabel("Titre français").fill("Coke classique");
  await row.getByLabel("Prix ($ CA)").fill("4,75");
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row.getByRole("status")).toContainText("Enregistré");
  const publicPage = await context.newPage();
  await publicPage.goto("/drinks");
  await expect(publicPage.locator("article").filter({ has: publicPage.getByRole("heading", { name: "Coke classique", exact: true }) }).getByTestId("drink-price")).toContainText("4,75");
  await publicPage.close();
  await row.getByLabel("Titre anglais").fill("Unsaved Coke");
  await row.getByRole("button", { name: "Annuler les modifications" }).click();
  await expect(row.getByLabel("Titre anglais")).toHaveValue("Coke");
  await page.route("**/api/admin/drinks/items/menu-coke", async route => {
    if (route.request().method() === "PATCH") await route.fulfill({ status: 503, json: { ok: false, error: { message: "Temporary save failure" } } }); else await route.continue();
  });
  await row.getByLabel("Prix ($ CA)").fill("5.50");
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row.getByRole("alert")).toContainText("Temporary save failure");
  await expect(row.getByLabel("Prix ($ CA)")).toHaveValue("5.50");
  await page.unroute("**/api/admin/drinks/items/menu-coke");
  // Simulate a second administrator updating the same drink.
  const before = (await (await context.request.get("/api/admin/drinks")).json()).data.items.find((i: { id: string }) => i.id === "menu-coke");
  expect((await context.request.patch("/api/admin/drinks/items/menu-coke", { data: { expectedUpdatedAt: before.updatedAt, priceCents: 500 } })).status()).toBe(200);
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row.getByRole("alert")).toContainText("changed elsewhere");
  page.once("dialog", dialog => dialog.accept());
  await row.getByRole("button", { name: "Recharger cette boisson" }).click();
  await expect(row.getByLabel("Prix ($ CA)")).toHaveValue("5.00");
  await row.getByLabel("Titre français").fill("Coke");
  await row.getByLabel("Prix ($ CA)").fill("");
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row.getByRole("status")).toContainText("Enregistré");
  await row.getByText("Détails, image et visibilité").click();
  await row.getByLabel("Afficher sur la carte").uncheck();
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row).toBeHidden();
  const hiddenMenu = await context.request.get("/drinks");
  expect((await hiddenMenu.text()).includes('<h3 class="text-base font-semibold leading-snug text-[#F5F0E7] sm:text-xl">Coke</h3>')).toBe(false);
  await page.getByLabel("Inclure les boissons masquées").check();
  await row.getByLabel("Afficher sur la carte").check();
  await row.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(row.getByRole("status")).toContainText("Enregistré");
  await row.getByText("Détails, image et visibilité").click();
  await page.getByLabel("Inclure les boissons masquées").uncheck();
  await expect(row.locator("img")).toHaveAttribute("src", /01-coke.webp$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/drinks-admin-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/drinks-admin-desktop.png", fullPage: true });
  await page.getByLabel("Inclure les boissons masquées").check();
  await expect(page.getByRole("form", { name: "Preserved drink", exact: true })).toBeVisible();
});

test("admin remains protected", async ({ page, request }) => {
  expect((await request.get("/api/admin/drinks")).status()).toBe(401);
  expect((await request.patch("/api/admin/drinks/items/menu-coke", { data: {} })).status()).toBe(401);
  await page.goto("/admin/drinks");
  await expect(page).toHaveURL(/\/admin\/login/);
});
