import { test, expect } from "@playwright/test";
import source from "../../content/official-delivery-menu.json";

test("public food menu is bilingual, complete, accessible and display-only", async ({ page }) => {
  test.setTimeout(120_000);
  const mutations: string[] = [];
  const ordering: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/") && request.method() !== "GET") mutations.push(request.url());
    if (/\/api\/(menu|orders|payments|clover)(\/|\?|$)/.test(request.url())) ordering.push(request.url());
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/menu");
    await expect(page.locator("h1")).toHaveText("Buffet Pin");
    const pickupBanner = page.locator("[data-menu-pickup-banner]");
    await expect(pickupBanner).toHaveText("Pour une commande à emporter, appelez le (450) 699-8088.");
    await expect(pickupBanner).toHaveAttribute("href", "tel:+14506998088");
    await expect(pickupBanner).toHaveCSS("background-color", "rgb(6, 47, 36)");
    await expect(pickupBanner).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(pickupBanner).toHaveCSS("text-align", "center");
    expect(await pickupBanner.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThan(await page.locator("h1").evaluate(element => element.getBoundingClientRect().top));
    await expect(page.locator("[data-menu-item]")).toHaveCount(65);
    await expect(page.locator('main section[id^="food-"]')).toHaveCount(13);
    await expect(page.locator("[data-menu-banner], [data-menu-image]")).toHaveCount(0);
    await expect(page.locator("[data-menu-food-image]")).toHaveCount(65);
    await expect(page.getByText("Images générées à titre illustratif. La présentation et les portions peuvent varier.", { exact: true })).toBeVisible();
    const foodImages = page.locator("[data-menu-food-image]");
    for (let index = 0; index < 65; index++) {
      const image = foodImages.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty("complete", true);
      expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(image).toHaveCSS("object-fit", "contain");
    }
    expect(await page.locator("[data-public-menu] *:not(select)").evaluateAll(elements => elements.every(element => getComputedStyle(element).backgroundImage === "none"))).toBe(true);
    const categoryIds = await page.locator('main section[id^="food-"]').evaluateAll(elements => elements.map(element => element.id));
    expect(categoryIds).toEqual([
      "food-combos", "food-appetizers", "food-dumplings", "food-soup", "food-chicken", "food-beef", "food-pork",
      "food-seafood", "food-vegetarian", "food-chop-suey", "food-rice", "food-noodles", "food-macaroni",
    ]);
    for (const item of source.items) {
      const article = page.locator(`[data-menu-item="${item.key}"]`);
      await expect(article.locator("h3")).toContainText(item.nameFr);
      await expect(article.locator("img")).toHaveAttribute("alt", item.nameFr);
      await expect(article.locator("[data-menu-price]")).toHaveText(new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(item.priceCents / 100));
    }
    await expect(page.locator('main a[href^="/order"]')).toHaveCount(0);
    await expect(page.locator("main article button, main article input, main article select")).toHaveCount(0);
    if (width < 1024) {
      await page.getByRole("combobox", { name: "Catégorie du menu", exact: true }).selectOption("food-combos");
    } else {
      const combos = page.getByRole("navigation", { name: "Catégories du menu" }).getByRole("link", { name: "Combos", exact: true });
      await combos.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(/#food-combos$/);
    expect(await page.locator("#food-combos").evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(80);
    await expect(page.locator('[data-menu-item="combo-7"]')).toContainText("Crevettes szechuanaises");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/display-menu-fr-${width}.png`, fullPage: false });
    const toggle = page.getByRole("button", { name: /English|EN|Choisir la langue/ }).last();
    await toggle.click();
    await expect(page.getByRole("searchbox")).toHaveAttribute("aria-label", "Search in Buffet Pin");
    await expect(pickupBanner).toHaveText("Call (450) 699-8088 to place a pickup order.");
    for (const item of source.items) {
      const article = page.locator(`[data-menu-item="${item.key}"]`);
      await expect(article.locator("h3")).toContainText(item.nameEn);
      await expect(article.locator("img")).toHaveAttribute("alt", item.nameEn);
      await expect(article.locator("[data-menu-price]")).toHaveText(new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(item.priceCents / 100));
    }
    await expect(page.locator('[data-menu-item="combo-7"]')).toContainText("Szechuan shrimp");
    await page.reload();
    await expect(page.getByRole("searchbox")).toHaveAttribute("aria-label", "Search in Buffet Pin");
    await page.screenshot({ path: `test-results/display-menu-en-${width}.png`, fullPage: false });
    await page.getByRole("button", { name: /Français|FR|Choose language/ }).last().click();
    await expect(page.getByRole("searchbox")).toHaveAttribute("aria-label", "Rechercher dans Buffet Pin");
    await page.getByRole("searchbox").fill("no-matching-dish-xyz");
    await expect(page.locator("[data-menu-item]")).toHaveCount(0);
    await expect(page.getByText("Aucun plat ne correspond à votre recherche.")).toBeVisible();
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(page.locator("[data-menu-item]")).toHaveCount(65);
    await page.getByRole("searchbox").fill("Won ton");
    const matches = await page.locator("[data-menu-item]").count();
    expect(matches).toBeGreaterThan(0);
    expect(matches).toBeLessThan(65);
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(page.locator("[data-public-menu]")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(0, 0, 0)");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/display-menu-order-style-${width}.png` });
    await page.goto("/");
    if (width < 1024) await page.getByRole("button", { name: "Ouvrir le menu", exact: true }).click();
    await page.getByRole("link", { name: "Menu", exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/menu$/);
  }
  expect(mutations).toEqual([]);
  expect(ordering).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /cart/i.test(key)))).toEqual([]);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/menu$/);
});
