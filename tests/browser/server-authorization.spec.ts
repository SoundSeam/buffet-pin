import { expect, test } from "@playwright/test";

test("launch mutation routes deny unauthenticated browser requests", async ({ request }) => {
  const cases: Array<[string, "post" | "patch", object]> = [
    ["/api/admin/runs", "post", { requestKey: "browser-auth-run", orderIds: ["order"], driverId: "driver" }],
    ["/api/admin/print-jobs/reprints", "post", { orderId: "order", requestKey: "browser-auth-reprint", reason: "test authorization" }],
    ["/api/admin/reconciliation", "post", { date: "2026-07-21", providerRows: [] }],
    ["/api/admin/order-settings", "patch", { onlineOrderingEnabled: false }],
    ["/api/admin/delivery-zones", "post", { action: "INSTALL_RECOMMENDED_CHATEAUGUAY_ZONES", reason: "authorization test request" }],
    ["/api/admin/delivery-zones/zone", "patch", { deliveryFeeCents: 399, minimumOrderCents: 2000, freeDeliveryThresholdCents: null, targetDriveMinutes: 10, reason: "authorization test request" }],
    ["/api/admin/orders/order/production", "post", { action: "transition", expected: "AWAITING_ACCEPTANCE", next: "ACCEPTED" }],
    ["/api/driver/runs/run/pickup", "post", {}],
  ];
  for (const [url, method, data] of cases) {
    const response = await request[method](url, { data });
    expect([401, 403], `${method.toUpperCase()} ${url}`).toContain(response.status());
  }
});

test("legacy direct assignment cannot be reached without dispatcher authority", async ({ request }) => {
  const response = await request.patch("/api/admin/orders/order/assign-driver", { data: { driverId: "driver" } });
  expect([401, 403]).toContain(response.status());
});

test("machine test status denies unauthenticated reads", async ({ request }) => {
  const response = await request.get("/api/admin/machine-test");
  expect(response.status()).toBe(401);
  const connection = await request.post("/api/admin/machine-test");
  expect(connection.status()).toBe(401);
});
