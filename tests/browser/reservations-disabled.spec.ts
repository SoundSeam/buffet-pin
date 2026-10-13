import { expect, test } from "@playwright/test";

test("disabled reservations show a large bilingual call message without a form", async ({ page, request }) => {
  const response = await request.get("/reservation?source=bookmark", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  await page.goto("/reservation");
  await expect(page).toHaveURL("/reservation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appelez pour réserver.");
  await expect(page.locator("main").getByRole("link", { name: "(450) 699-8088" })).toHaveAttribute("href", "tel:+14506998088");
  await expect(page.locator("main form")).toHaveCount(0);
  await page.getByRole("button", { name: "Choisir la langue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Call to reserve.");
});

for (const width of [1280, 390]) {
  test(`booking links are absent across public pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/reservation"]) {
      await page.goto(path);
      if (width < 1024) {
        await page.locator('button[aria-controls="primary-navigation-mobile"]').click();
        await expect(page.locator("#primary-navigation-mobile")).toBeVisible();
      }
      await expect(page.locator('a[href="/reservation"]')).toHaveCount(0);
    }
  });
}

test("disabled booking endpoints reject direct submissions", async ({ request }) => {
  for (const path of ["/api/reservations", "/api/reservations/availability"]) {
    const response = await request.post(path, { data: {} });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "RESERVATIONS_DISABLED" } });
  }
});
