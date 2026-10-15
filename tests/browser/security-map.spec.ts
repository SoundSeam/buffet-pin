import { test, expect } from "@playwright/test";
import sharp from "sharp";

// Real map/worker with deterministic raster tiles, no external routing/account.
test("patched MapLibre renders zones with a same-origin bundled worker", async ({ page, context }) => {
  const workers: string[] = [];
  page.on("worker", worker => workers.push(worker.url()));
  const tile = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#fafafa" } }).png().toBuffer();
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/png", body: tile }));
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("manager@example.test");
  await page.getByLabel("Password").fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect.poll(async () => (await context.cookies()).some(cookie => cookie.name.startsWith("sb-"))).toBe(true);
  await page.goto("/admin/delivery-zones");
  const map = page.locator('[aria-label="Map of the four Buffet Pin delivery zones"]');
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
  await expect(map.locator("canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  expect(workers.some(url => new URL(url).pathname === "/maplibre-worker.js")).toBe(true);
  await expect(page.getByText("Map unavailable on this device.", { exact: false })).toHaveCount(0);
});
