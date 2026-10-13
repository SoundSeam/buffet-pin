import type { DeliveryZone } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { RECOMMENDED_CHATEAUGUAY_ZONES } from "@/lib/orders/chateauguay-delivery-zones";
import { DeliveryValidationError, selectMatchingZone } from "@/lib/orders/delivery";

function zone(overrides: Partial<DeliveryZone>): DeliveryZone {
  return {
    id: "zone",
    configurationKey: null,
    name: "Zone",
    isActive: true,
    centerLatitude: 45.3610197,
    centerLongitude: -73.7142625,
    radiusKm: 100,
    boundaryGeoJson: null,
    displayColor: null,
    description: null,
    targetDriveMinutes: null,
    deliveryFeeCents: 0,
    minimumOrderCents: 0,
    freeDeliveryThresholdCents: null,
    sortOrder: 0,
    createdAt: new Date("2026-08-11T00:00:00Z"),
    updatedAt: new Date("2026-08-11T00:00:00Z"),
    ...overrides,
  };
}

describe("delivery-zone selection", () => {
  it("ignores a legacy circle as soon as polygon coverage is configured", () => {
    const legacyCircle = zone({ id: "legacy", name: "Legacy circle" });
    const east = RECOMMENDED_CHATEAUGUAY_ZONES[0];
    const polygon = zone({
      id: "east",
      configurationKey: east.configurationKey,
      name: east.name,
      boundaryGeoJson: east.boundaryGeoJson,
    });

    expect(() =>
      selectMatchingZone([legacyCircle, polygon], {
        latitude: 45.5019,
        longitude: -73.5674,
      }),
    ).toThrowError(DeliveryValidationError);
  });

  it("keeps the first configured polygon when two boundaries share an edge", () => {
    const first = RECOMMENDED_CHATEAUGUAY_ZONES[0];
    const second = RECOMMENDED_CHATEAUGUAY_ZONES[1];
    const sharedPoint = { latitude: 45.342, longitude: -73.735 };
    const match = selectMatchingZone(
      [
        zone({ id: "first", name: first.name, boundaryGeoJson: first.boundaryGeoJson }),
        zone({ id: "second", name: second.name, boundaryGeoJson: second.boundaryGeoJson }),
      ],
      sharedPoint,
    );

    expect(match.zone.id).toBe("first");
  });

  it("retains circle matching when no polygon is configured", () => {
    const match = selectMatchingZone(
      [zone({ id: "legacy", radiusKm: 2 })],
      { latitude: 45.362, longitude: -73.714 },
    );

    expect(match.zone.id).toBe("legacy");
  });
});
