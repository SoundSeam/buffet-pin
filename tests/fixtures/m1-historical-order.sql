INSERT INTO "Customer" (
  "id", "name", "phone", "createdAt", "updatedAt"
) VALUES (
  'm1-legacy-customer', 'Historical Fixture', '+15555550199', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "Order" (
  "id", "publicCode", "serviceType", "paymentStatus", "fulfillmentStatus",
  "customerId", "customerName", "customerPhone", "itemsSubtotalCents",
  "taxableSubtotalCents", "taxCents", "totalCents", "createdAt", "updatedAt"
) VALUES
  ('m1-legacy-delivered', 'LEGACYDLV1', 'DELIVERY', 'PAID', 'DELIVERED', 'm1-legacy-customer', 'Historical Fixture', '+15555550199', 1000, 1000, 150, 1150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('m1-legacy-rejected', 'LEGACYREJ1', 'DELIVERY', 'PAID', 'REJECTED', 'm1-legacy-customer', 'Historical Fixture', '+15555550199', 1000, 1000, 150, 1150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('m1-legacy-cancelled', 'LEGACYCAN1', 'DELIVERY', 'PENDING', 'CANCELLED', 'm1-legacy-customer', 'Historical Fixture', '+15555550199', 1000, 1000, 150, 1150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Order" (
  "id", "publicCode", "serviceType", "paymentStatus", "fulfillmentStatus",
  "customerId", "customerName", "customerPhone", "itemsSubtotalCents",
  "taxableSubtotalCents", "taxCents", "deliveryFeeCents", "tipCents",
  "totalCents", "createdAt", "updatedAt"
) VALUES (
  'm1-legacy-order', 'LEGACYCODE1', 'DELIVERY', 'PAID', 'PREPARING',
  'm1-legacy-customer', 'Historical Fixture', '+15555550199', 2500,
  2500, 374, 500, 300, 3674, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
