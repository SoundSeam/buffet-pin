import { expect, test, type BrowserContext } from "@playwright/test";

async function signIn(context: BrowserContext) {
  const payload = Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: "test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "11111111-1111-4111-8111-111111111111", email: "reservation-admin@example.test" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "localhost", path: "/" }]);
}

test("disabled public site shows phone message and no booking links on desktop/mobile", async ({ page, request }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/reservation", "/reservation/manage"]) {
      await page.goto(path);
      if (width === 390) await page.locator('button[aria-controls="primary-navigation-mobile"]').click();
      await expect(page.locator('a[href="/reservation"]')).toHaveCount(0);
    }
  }
  await page.goto("/reservation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appelez pour réserver.");
  await expect(page.getByRole("heading", { name: "Faire une réservation", exact: true })).toHaveCount(0);
  await expect(page.locator('main a[href="tel:+14506998088"]')).toHaveText("(450) 699-8088");
  await page.getByRole("button", { name: "Choisir la langue" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Call to reserve.");
  for (const path of ["/api/reservations", "/api/reservations/availability"]) {
    const response = await request.post(path, { data: {} });
    expect(response.status()).toBe(503);
  }
  expect((await request.patch("/api/admin/settings", { data: { onlineReservationsEnabled: true } })).status()).toBe(401);
});

test("administrator can discard, save, reopen and close booking without changing capacities", async ({ page, context }) => {
  await signIn(context);
  await page.goto("/admin/settings");
  const toggle = page.getByRole("switch", { name: "Réservations en ligne" });
  await expect(toggle).toBeChecked({ checked: false });
  const before = await (await context.request.get("/api/admin/settings")).json();
  await toggle.click();
  await page.getByRole("button", { name: "Annuler les modifications" }).click();
  await expect(toggle).toBeChecked({ checked: false });
  await toggle.click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Paramètres enregistrés.");
  await page.reload();
  await expect(toggle).toBeChecked();
  await page.goto("/reservation");
  await expect(page.getByRole("heading", { name: "Faire une réservation", exact: true })).toBeVisible();
  await expect(page.locator('nav a[href="/reservation"]').first()).toBeVisible();
  await page.goto("/");
  expect(await page.locator('a[href="/reservation"]').count()).toBeGreaterThanOrEqual(3);
  await page.goto("/admin/settings");
  await toggle.click();
  const save = page.waitForRequest((r) => r.url().endsWith("/api/admin/settings") && r.method() === "PATCH");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  expect((await save).postDataJSON()).toEqual({ onlineReservationsEnabled: false });
  await expect(page.getByRole("status")).toHaveText("Paramètres enregistrés.");
  const after = await (await context.request.get("/api/admin/settings")).json();
  expect(after.data.settings.slotCapacities).toEqual(before.data.settings.slotCapacities);
  await page.goto("/reservation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appelez pour réserver.");
  await expect(page.getByRole("heading", { name: "Faire une réservation", exact: true })).toHaveCount(0);
});
