import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Local disposable database only; no provider credentials or real reservations.
const db = new PrismaClient({ datasourceUrl: "postgresql://reservation_test@127.0.0.1:55439/reservation_switch_test" });
test.afterAll(() => db.$disconnect());

test("existing booking controls offer only 6–12 and localized phone guidance on desktop/mobile", async ({ page }) => {
  const before = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: true } });
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/reservation");
      await expect(page.locator('[data-testid^="party-size-"]')).toHaveText(["6", "7", "8", "9", "10", "11", "12"]);
      await expect(page.getByText("Pour les groupes de plus de 12 personnes, veuillez nous appeler directement.")).toBeVisible();
      await expect(page.getByTestId("party-size-6")).toHaveCSS("background-color", "rgb(6, 47, 36)");
      await expect(page.getByTestId("party-size-5")).toHaveCount(0);
      await page.getByTestId("party-size-12").click();
      await expect(page.getByTestId("party-size-12")).toHaveCSS("background-color", "rgb(6, 47, 36)");
      await expect(page.getByTestId("party-size-13")).toHaveCount(0);
      await page.screenshot({ path: `.vercel/party-size-fr-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Choisir la langue" }).click();
      await expect(page.getByText("For parties over 12 guests, please call us directly.")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `.vercel/party-size-en-${width}.png`, fullPage: true });
      // Return to French for the next viewport.
      await page.getByRole("button", { name: "Choose language" }).click();
    }
  } finally {
    await db.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: before.onlineReservationsEnabled } });
  }
});

for (const partySize of [4, 15]) {
test(`existing party of ${partySize} retains its real size and contact/cancel controls`, async ({ page }) => {
  const date = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const token = "party-size-browser-test-token-0000000000000000000000";
  const booking = await db.reservation.create({ data: {
    confirmationCode: "LIMITBROWSER", manageToken: token, reservationDate: new Date(date),
    reservationTime: new Date("1970-01-01T17:00:00Z"), reservationAt: new Date(`${date}T21:00:00Z`),
    partySize, guestName: "Browser Test Guest", guestPhone: "+15145550197", status: "CONFIRMED",
  } });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/reservation/manage?token=${token}`);
    await expect(page.getByRole("combobox", { name: "Party size", exact: true })).toHaveValue(String(partySize));
    await expect(page.getByRole("combobox", { name: "Party size", exact: true }).locator("option")).toHaveText(["6", "7", "8", "9", "10", "11", "12", String(partySize)]);
    await expect(page.getByLabel("Date", { exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Time", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Name", { exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cancel reservation", exact: true })).toBeEnabled();
    await expect(page.getByText("Pour les groupes de plus de 12 personnes, veuillez nous appeler directement.")).toBeVisible();
    await page.screenshot({ path: `.vercel/party-size-manage-${partySize}-390.png`, fullPage: true });
    await page.getByRole("combobox", { name: "Party size", exact: true }).selectOption("6");
    await expect(page.getByLabel("Date", { exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Time", exact: true })).toBeEnabled();
  } finally {
    await db.reservation.delete({ where: { id: booking.id } });
  }
});

}
