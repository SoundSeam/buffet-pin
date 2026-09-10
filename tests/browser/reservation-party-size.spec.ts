import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Local disposable database only; no provider credentials or real reservations.
const db = new PrismaClient({ datasourceUrl: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test" });
test.afterAll(() => db.$disconnect());

test("existing booking controls offer only 1–5 and localized phone guidance on desktop/mobile", async ({ page }) => {
  const before = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: true } });
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/reservation");
      await expect(page.locator('[data-testid^="party-size-"]')).toHaveText(["1", "2", "3", "4", "5"]);
      await expect(page.getByText("Pour les groupes de 6 personnes ou plus, veuillez appeler le (450) 699-8088 pour réserver.")).toBeVisible();
      await page.getByTestId("party-size-5").click();
      await expect(page.getByTestId("party-size-5")).toHaveCSS("background-color", "rgb(6, 47, 36)");
      await expect(page.getByTestId("party-size-6")).toHaveCount(0);
      await page.screenshot({ path: `.vercel/party-size-fr-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Choisir la langue" }).click();
      await expect(page.getByText("For parties of 6 or more, please call (450) 699-8088 to reserve.")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `.vercel/party-size-en-${width}.png`, fullPage: true });
      // Return to French for the next viewport.
      await page.getByRole("button", { name: "Choose language" }).click();
    }
  } finally {
    await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: before.onlineReservationsEnabled } });
  }
});

test("existing larger reservation retains its real size and contact/cancel controls", async ({ page }) => {
  const date = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const token = "party-size-browser-test-token-0000000000000000000000";
  const booking = await db.reservation.create({ data: {
    confirmationCode: "LIMITBROWSER", manageToken: token, reservationDate: new Date(date),
    reservationTime: new Date("1970-01-01T17:00:00Z"), reservationAt: new Date(`${date}T21:00:00Z`),
    partySize: 8, guestName: "Browser Test Guest", guestPhone: "+15145550197", status: "CONFIRMED",
  } });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/reservation/manage?token=${token}`);
    await expect(page.getByRole("combobox", { name: "Party size", exact: true })).toHaveValue("8");
    await expect(page.getByRole("combobox", { name: "Party size", exact: true }).locator("option")).toHaveText(["1", "2", "3", "4", "5", "8"]);
    await expect(page.getByLabel("Date", { exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Time", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Name", { exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel reservation", exact: true })).toBeEnabled();
    await expect(page.getByText("Pour les groupes de 6 personnes ou plus, veuillez appeler le (450) 699-8088 pour réserver.")).toBeVisible();
    await page.screenshot({ path: ".vercel/party-size-manage-390.png", fullPage: true });
    await page.getByRole("combobox", { name: "Party size", exact: true }).selectOption("5");
    await expect(page.getByLabel("Date", { exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Time", exact: true })).toBeEnabled();
  } finally {
    await db.reservation.delete({ where: { id: booking.id } });
  }
});
