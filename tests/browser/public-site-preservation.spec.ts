import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`deployed reservation controls remain available when the persistent switch is enabled at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/reservations/status", route => route.fulfill({ json: { onlineReservationsEnabled: true } }));
    await page.goto("/reservation");
    await expect(page.locator('[data-testid^="party-size-"]')).toHaveText(["6", "7", "8", "9", "10", "11", "12"]);
    await expect(page.getByTestId("party-size-6")).toHaveCSS("background-color", "rgb(6, 47, 36)");
    await page.getByTestId("party-size-12").click();
    await expect(page.getByTestId("party-size-12")).toHaveCSS("background-color", "rgb(6, 47, 36)");
    await page.getByRole("button", { name: "Choisir la langue" }).click();
    await expect(page.getByText("For parties over 12 guests, please call us directly.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("drinks retain the deployed dark shell and normal navigation away", async ({ page }) => {
  await page.goto("/drinks");
  await expect(page.locator("body > div").filter({ has: page.locator("#main-content") }).first()).toHaveCSS("background-color", "rgb(2, 3, 5)");
  await expect(page.locator("nav").first()).toHaveCSS("background-color", "rgb(2, 3, 5)");
  await page.goto("/reservation");
  await expect(page.locator("nav").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
