import { expect, test } from "@playwright/test";

test("baseline fake flow renders delivered and recoverable exception states", async ({ page }) => {
  await page.goto("/dev/fake-order-flow");

  await expect(page.getByLabel("delivered-order").getByText("DELIVERED")).toBeVisible();
  await expect(page.getByLabel("print-exception").getByText("PAID_BUT_UNPRINTED")).toBeVisible();
  await expect(page.getByText(/Retry the known-failed print intent/)).toBeVisible();
  await expect(page.getByText("Recovered to: DELIVERED")).toBeVisible();
});
