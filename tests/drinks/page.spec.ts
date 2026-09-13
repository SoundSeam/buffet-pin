import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1440]) {
  test(`drinks image and full-page theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/drinks");
    const image = page.locator('main img[src$="/misc/Drinks.jpg"]');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 1700)).toBe(true);
    const rect = await image.boundingBox();
    expect(rect!.width).toBe(width >= 1280 ? 1216 : width - 48);
    expect(rect!.height / rect!.width).toBeCloseTo(2400 / 1700, 2);
    for (const selector of ["body", "nav", "footer"]) {
      await expect(page.locator(selector)).toHaveCSS("background-color", "rgb(2, 3, 5)");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const textColors = await page.locator("footer h4, footer a, footer p, footer span").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
    expect(textColors.every((color) => color === "rgb(255, 255, 255)")).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator("nav")).toHaveCSS("background-color", "rgb(2, 3, 5)");
    if (width < 1024) {
      const menu = page.locator('button[aria-controls="primary-navigation-mobile"]');
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#primary-navigation-mobile")).toHaveCSS("background-color", "rgb(2, 3, 5)");
      await expect(page.locator("#primary-navigation-mobile a").first()).toHaveCSS("color", "rgb(255, 255, 255)");
      await menu.click();
    } else {
      await expect(page.locator("nav a").nth(1)).toHaveCSS("color", "rgb(255, 255, 255)");
    }
    await page.getByRole("button", { name: "Choisir la langue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Drink Menu");
    await expect(image).toHaveAttribute("alt", /^Drink menu:/);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `test-results/drinks-${width}.png`, fullPage: true, animations: "disabled" });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(page.locator("footer h4").first()).toBeVisible();
    await page.locator("footer").screenshot({ path: `test-results/drinks-footer-${width}.png`, animations: "disabled" });
    // Client navigation must remove the opt-in theme, including body overscroll.
    await page.locator('nav a[aria-label="Buffet PIN"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("footer")).toHaveCSS("background-color", "rgb(4, 31, 24)");
    await expect(page.locator("body")).not.toHaveCSS("background-color", "rgb(2, 3, 5)");
    await page.goto("/reservation");
    await expect(page.locator("nav")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });
}
