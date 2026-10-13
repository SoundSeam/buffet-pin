import { expect, test, type Browser, type Page } from "@playwright/test";

const password = "browser-test-password";

async function authenticatedPage(
  browser: Browser,
  email: string,
  destination: string,
  beforeDestination?: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const authResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/token") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect((await authResponse).ok()).toBeTruthy();
  await expect
    .poll(async () =>
      (await context.cookies()).some((cookie) => cookie.name.startsWith("sb-")),
    )
    .toBeTruthy();
  await beforeDestination?.(page);
  await page.goto(destination);
  return { context, page };
}

test.describe("authenticated launch workflows", () => {
  test.describe.configure({ mode: "serial" });

  test("technical support sees the real Clover menu blocker", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "technical@example.test",
      "/admin/catalog",
    );
    await expect(
      page.getByRole("heading", { name: "Clover Menu Connection" }),
    ).toBeVisible();
    await expect(
      page.getByText("Needs attention", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/^0 of \d+ connected$/)).toBeVisible();
    const adminNavigation = page.getByRole("navigation", {
      name: "Developer tools",
    });
    await expect(adminNavigation).toBeVisible();
    await expect(
      adminNavigation.getByRole("link", {
        name: "Clover menu connection",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await expect(adminNavigation.getByRole("link")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(0);

    await page.setViewportSize({ width: 1920, height: 1000 });
    const gutters = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>(
        "[data-admin-page-content]",
      );
      const title = document.querySelector<HTMLElement>(
        "[data-admin-page-header] h1",
      );
      const signOut = document.querySelector<HTMLElement>(
        'header [aria-label="Sign Out"]',
      );
      if (!content || !title || !signOut) return null;

      const contentStyle = window.getComputedStyle(content);
      return {
        contentLeft: content.getBoundingClientRect().left,
        contentPaddingLeft: Number.parseFloat(contentStyle.paddingLeft),
        contentPaddingRight: Number.parseFloat(contentStyle.paddingRight),
        signOutRight: signOut.getBoundingClientRect().right,
        titleLeft: title.getBoundingClientRect().left,
        viewportWidth: window.innerWidth,
      };
    });
    expect(gutters).not.toBeNull();
    expect(gutters!.titleLeft).toBe(
      gutters!.contentLeft + gutters!.contentPaddingLeft,
    );
    expect(gutters!.signOutRight).toBe(
      gutters!.viewportWidth - gutters!.contentPaddingRight,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(adminNavigation).toBeHidden();
    await page.getByRole("button", { name: "Open admin navigation" }).click();
    await expect(adminNavigation).toBeVisible();
    await expect(
      adminNavigation.getByRole("link", {
        name: "Clover menu connection",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    const deniedRefundStatus = await page.evaluate(async () =>
      fetch("/api/admin/refunds/not-a-refund/submit", { method: "POST" }).then(
        (response) => response.status,
      ),
    );
    expect(deniedRefundStatus).toBe(403);
    await page.goto("/admin/operations");
    await expect(page).toHaveURL(/\/dev\/operations$/);
    await expect(
      page.getByRole("heading", { name: "Problems and recovery" }),
    ).toBeVisible();
    await context.close();
  });

  test("manager sees only the restaurant workflow and a useful home", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin",
    );
    await expect(
      page.getByRole("heading", { name: "Restaurant operations" }),
    ).toBeVisible();
    const navigation = page.getByRole("navigation", {
      name: "Restaurant operations",
    });
    await expect(navigation.getByRole("link")).toHaveCount(5);
    for (const label of [
      "Kitchen Controller",
      "Drivers",
      "Reservations",
      "Menu",
      "Settings",
    ]) {
      await expect(
        navigation.getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      navigation.getByText(/Clover|reconciliation|machine/i),
    ).toHaveCount(0);
    await page.goto("/admin/orders");
    await expect(
      page.getByRole("heading", { name: "Kitchen Controller" }),
    ).toBeVisible();
    await expect(
      page.getByText(/idempotency|Clover ID|provider payload/i),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 1365, height: 768 });
    await page.goto("/admin/reservations");
    const sidebarTopBeforeScroll = await page
      .locator("#admin-sidebar")
      .evaluate((sidebar) => sidebar.getBoundingClientRect().top);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const shellEdges = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>("#admin-sidebar");
      const content = document.querySelector<HTMLElement>("#main-content");
      if (!sidebar || !content) return null;

      return {
        bottomLeftOwner:
          document
            .elementFromPoint(8, window.innerHeight - 2)
            ?.closest("#admin-sidebar")?.id ?? null,
        contentBottom: content.getBoundingClientRect().bottom,
        sidebarBackground: window.getComputedStyle(sidebar).backgroundColor,
        sidebarBottom: sidebar.getBoundingClientRect().bottom,
        sidebarClientHeight: sidebar.clientHeight,
        sidebarOverflowY: window.getComputedStyle(sidebar).overflowY,
        sidebarPosition: window.getComputedStyle(sidebar).position,
        sidebarScrollHeight: sidebar.scrollHeight,
        sidebarScrollTop: sidebar.scrollTop,
        sidebarTop: sidebar.getBoundingClientRect().top,
        viewportHeight: window.innerHeight,
      };
    });
    expect(shellEdges).not.toBeNull();
    expect(shellEdges!.bottomLeftOwner).toBe("admin-sidebar");
    expect(shellEdges!.sidebarBackground).toBe("rgb(255, 255, 255)");
    expect(shellEdges!.sidebarPosition).toBe("fixed");
    expect(shellEdges!.sidebarTop).toBe(sidebarTopBeforeScroll);
    expect(shellEdges!.sidebarBottom).toBe(shellEdges!.viewportHeight);
    expect(shellEdges!.contentBottom).toBe(shellEdges!.viewportHeight);
    expect(shellEdges!.sidebarOverflowY).toBe("auto");
    expect(shellEdges!.sidebarScrollHeight).toBe(
      shellEdges!.sidebarClientHeight,
    );
    expect(shellEdges!.sidebarScrollTop).toBe(0);
    await page.goto("/dev");
    await expect(page).toHaveURL(/\/admin$/);
    await context.close();
  });

  test("manager can set the pilot cap, busy mode, and receipt details without database access", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin/settings/orders",
    );
    await expect(
      page.getByRole("heading", { name: "Order settings" }),
    ).toBeVisible();
    await expect(page.getByLabel("Online ordering")).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "Delivery", exact: true })
      .uncheck();
    await page.getByLabel("Maximum active orders").fill("4");
    await page
      .getByRole("checkbox", { name: "Busy mode", exact: true })
      .check();
    await page.getByLabel("Extra minutes in busy mode").fill("15");
    await page.getByText("Receipt & notifications", { exact: true }).click();
    await page.getByLabel("Business legal name").fill("Buffet Pin Test");
    await expect(page.getByLabel("Allow partial refunds")).not.toBeChecked();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Order settings saved.",
    );

    const settings = await page.evaluate(async () =>
      fetch("/api/admin/order-settings", { cache: "no-store" })
        .then((response) => response.json())
        .then((body) => body.data.settings),
    );
    expect(settings).toMatchObject({
      onlineOrderingEnabled: false,
      deliveryEnabled: false,
      maxActiveOrders: 4,
      busyModeEnabled: true,
      busyModeExtraMinutes: 15,
      partialRefundsEnabled: false,
      receiptLegalName: "Buffet Pin Test",
    });
    await context.close();
  });

  test("manager can close a missed-order acknowledgement without hiding a live order", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin/orders",
      async (authenticated) => {
        await authenticated.route(
          "**/api/admin/orders?limit=200",
          async (route) => {
            const response = await route.fetch();
            const body = (await response.json()) as {
              data: {
                orders: Array<{
                  id: string;
                  acceptanceDeadlineAt: string | null;
                }>;
              };
            };
            body.data.orders = body.data.orders.map((order) =>
              order.id === "browser-new-order"
                ? {
                    ...order,
                    acceptanceDeadlineAt: new Date(
                      Date.now() - 60_000,
                    ).toISOString(),
                  }
                : order,
            );
            await route.fulfill({ response, json: body });
          },
        );
      },
    );

    const missedDialog = page.getByRole("dialog");
    await expect(missedDialog).toContainText("BP-260722-9000");
    await expect(missedDialog).toContainText("Response window missed");
    await expect(
      missedDialog.getByRole("button", { name: "Accept", exact: true }),
    ).toHaveCount(0);
    await missedDialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.locator("article").filter({ hasText: "BP-260722-9000" }),
    ).toBeVisible();
    await page.unrouteAll({ behavior: "wait" });
    await context.close();
  });

  test("a failed acceptance restores the mandatory live-order alarm", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin/orders",
      async (authenticated) => {
        await authenticated.route(
          "**/api/admin/orders/browser-new-order/accept",
          async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 750));
            await route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                ok: false,
                error: {
                  code: "ORDER_CHANGED",
                  message: "The order changed while it was being accepted.",
                },
              }),
            });
          },
        );
      },
    );

    await expect(page.getByRole("dialog")).toContainText("BP-260722-9000");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Accept", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 300 });
    await expect(page.getByRole("dialog")).toContainText("BP-260722-9000");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "The order changed while it was being accepted." }),
    ).toBeVisible();
    await context.close();
  });

  test("manager operates the paid order through acceptance, preparation, and physical handoff", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin/orders",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Kitchen Controller" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("BP-260722-9000");
    await expect(page.getByRole("dialog")).toContainText(/\d+:\d{2}/);
    const alarmDialog = page.getByRole("dialog");
    const initialActions = await alarmDialog.getByRole("button").allTextContents();
    expect(
      initialActions
        .map((label) => label.trim())
        .filter((label) => label === "Refuse" || label === "Accept"),
    ).toEqual(["Refuse", "Accept"]);
    await alarmDialog
      .getByRole("button", { name: "Refuse", exact: true })
      .click();
    const refusalDialog = page.getByRole("dialog");
    await expect(
      refusalDialog.getByRole("heading", { name: "Refuse BP-260722-9000?" }),
    ).toBeVisible();
    await expect(refusalDialog).toContainText(
      "starts the required refund workflow",
    );
    await expect(
      refusalDialog.getByLabel("Reason for refusing"),
    ).toBeFocused();
    await refusalDialog
      .getByRole("button", { name: "Refuse", exact: true })
      .click();
    await expect(refusalDialog.getByRole("alert")).toHaveText(
      "Enter a reason before refusing the order.",
    );
    await refusalDialog.getByRole("button", { name: "Keep order" }).click();
    await expect(page.getByRole("dialog")).toContainText("BP-260722-9000");
    await page.route(
      "**/api/admin/orders/browser-new-order/accept",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 750));
        await route.continue();
      },
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Accept", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 300 });

    const order = page.locator("article").filter({ hasText: "BP-260722-9000" });
    await expect(order).toContainText("Ready target");
    let promptCount = 0;
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        promptCount += 1;
        await dialog.accept(promptCount === 1 ? "5" : "Browser kitchen delay");
      }
    });
    await order.getByRole("button", { name: "Add time" }).click();
    await expect(
      page.getByText("5 minutes added to BP-260722-9000."),
    ).toBeVisible();
    await expect(order).toContainText("+5 min");

    page.once("dialog", (dialog) => dialog.accept());
    await order.getByRole("button", { name: "Ready for delivery" }).click();
    await expect(
      page.getByText("BP-260722-9000 is ready for delivery."),
    ).toBeVisible();
    const recommendation = page
      .locator("article")
      .filter({ hasText: "Browser Dispatch Driver" })
      .first();
    await expect(recommendation).toContainText("BP-260722-9000");
    page.once("dialog", (dialog) => dialog.accept());
    await recommendation
      .getByRole("button", { name: "Confirm bags and dispatch" })
      .click();
    await expect(
      page.getByText(/handed to Browser Dispatch Driver/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Handed to driver" }),
    ).toBeVisible();

    const reservationCount = await page.evaluate(async () =>
      fetch("/api/admin/reservations", { cache: "no-store" })
        .then((response) => response.json())
        .then((body) => body.data.reservations.length),
    );
    expect(reservationCount).toBe(1);
    await context.close();
  });

  test("technical support gets one human machine-test action and a plain diagnosis", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "technical@example.test",
      "/admin/machine-test",
    );
    await expect(
      page.getByRole("heading", { name: "Clover & Printer Test", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/one real charge/i)).toBeVisible();
    await page.getByRole("button", { name: "Run live test" }).click();
    await expect(
      page.getByRole("heading", { name: /fake providers/i }),
    ).toBeVisible();
    await expect(page.getByText("Physical checklist")).toHaveCount(0);
    await context.close();
  });

  test("manager can review and safely install the four polygon delivery zones", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "manager@example.test",
      "/admin/delivery-zones",
    );
    await expect(
      page.getByRole("heading", { name: "Delivery zones" }),
    ).toBeVisible();
    await expect(
      page.getByText("Zone 1 — Saint-Jean-Baptiste / East"),
    ).toBeVisible();
    await expect(
      page.getByText("Zone 4 — Mercier / Route 138 South"),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Install these four zones" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Four delivery zones installed",
    );

    const nearZone = page.locator("article").filter({
      hasText: "Zone 1 — Saint-Jean-Baptiste / East",
    });
    await nearZone
      .getByRole("button", { name: "Change fee or minimum" })
      .click();
    await nearZone
      .getByLabel("Zone 1 — Saint-Jean-Baptiste / East fee")
      .fill("4.25");
    await nearZone.getByRole("button", { name: "Save", exact: true }).click();
    await expect(nearZone).toContainText("$4.25");

    const zones = await page.evaluate(async () =>
      fetch("/api/admin/delivery-zones?includeInactive=true", {
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((body) => body.data.zones),
    );
    expect(
      zones.filter(
        (zone: { isActive: boolean; configurationKey: string | null }) =>
          zone.isActive && zone.configurationKey?.startsWith("CHATEAUGUAY_"),
      ),
    ).toHaveLength(4);
    await context.close();
  });

  test("operator lands in the unified controller and is denied catalog authority", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "operator@example.test",
      "/admin/production",
    );
    await expect(
      page.getByRole("heading", { name: "Kitchen Controller" }),
    ).toBeVisible();
    const operatorNavigation = page.getByRole("navigation", {
      name: "Restaurant operations",
    });
    await expect(
      operatorNavigation.getByRole("link", { name: "Kitchen Controller", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      operatorNavigation.getByRole("link", { name: "Menu", exact: true }),
    ).toHaveCount(0);
    const deniedStatus = await page.evaluate(async () =>
      fetch("/api/admin/catalog/sync-report", { cache: "no-store" }).then(
        (response) => response.status,
      ),
    );
    expect(deniedStatus).toBe(401);
    await page.goto("/admin/catalog");
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await context.close();
  });

  test("dispatcher is routed to driver support instead of the retired dispatch board", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "dispatcher@example.test",
      "/admin/dispatch",
    );
    await expect(page).toHaveURL(/\/admin\/drivers$/);
    await expect(page.getByRole("heading", { name: /Drivers/i })).toBeVisible();
    await context.close();
  });

  test("reporting role has reconciliation access and no dispatch mutation authority", async ({
    browser,
  }) => {
    const { context, page } = await authenticatedPage(
      browser,
      "reporting@example.test",
      "/admin/reconciliation",
    );
    await expect(
      page.getByRole("heading", { name: "Daily report" }),
    ).toBeVisible();
    const reportingNavigation = page.getByRole("navigation", {
      name: "Reports",
    });
    await expect(
      reportingNavigation.getByRole("link", {
        name: "Daily",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      reportingNavigation.getByRole("link", {
        name: "Restaurant",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Import and compare" }),
    ).toHaveCount(0);
    const deniedStatus = await page.evaluate(async () =>
      fetch("/api/admin/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestKey: "reporter-denied",
          orderIds: ["browser-dispatch-order"],
          driverId: "browser-driver",
        }),
      }).then((response) => response.status),
    );
    expect(deniedStatus).toBe(403);
    await page.goto("/admin/dispatch");
    await expect(page).toHaveURL(/\/reports$/);
    await context.close();
  });

  test("driver arrives, stores private photo proof, and completes the run", async ({
    page,
  }) => {
    await page.goto("/driver/access/browser-driver-token");
    await expect(page).toHaveURL(/\/driver\/runs$/);
    await expect(page.getByText("RUN-BROWSER-001")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "BP-260722-9003" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "I have arrived" }).click();
    await expect(page.getByRole("heading", { name: "Delivery photo" })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "dropoff.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByAltText("Delivery proof preview")).toBeVisible();
    await page.getByRole("button", { name: "Store this photo" }).click();
    await expect(page.getByText("Delivery photo stored privately.")).toBeVisible();
    await page.getByRole("button", { name: "Finalize delivery" }).click();
    await expect(
      page.getByRole("heading", { name: "Return to Buffet PIN" }),
    ).toBeVisible();
  });
});
