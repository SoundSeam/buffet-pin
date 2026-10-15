import { test, expect } from "@playwright/test";

// Expected values measured from the v3 stylesheet on the exact same menu DOM.
for (const width of [390, 1440]) {
  test(`security compiler migration preserves menu typography and controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/menu");
    const title = page.locator("main h1");
    await expect(title).toHaveCSS("font-size", width < 640 ? "30px" : "36px");
    await expect(title).toHaveCSS("line-height", width < 640 ? "37.5px" : "40px");
    await expect(title).toHaveCSS("font-weight", "600");
    const search = page.getByRole("searchbox");
    await expect(search).toHaveCSS("height", "48px");
    await expect(search).toHaveCSS("border-radius", "8px");
    await expect(search).toHaveCSS("background-color", "rgb(245, 245, 245)");
    if (width < 1024) {
      await expect(page.getByRole("combobox")).toHaveCSS("padding-right", "48px");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/security-menu-${width}.png`, fullPage: true, animations: "disabled" });
  });
}
