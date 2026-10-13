import { describe, expect, it } from "vitest";

import { RECOMMENDED_CHATEAUGUAY_ZONES } from "@/lib/orders/chateauguay-delivery-zones";
import {
  parseDeliveryZonePolygon,
  pointIsInDeliveryZonePolygon,
} from "@/lib/orders/delivery-zone-geometry";

const expectedLocations = [
  { name: "restaurant", latitude: 45.3610197, longitude: -73.7142625, zoneIndex: 0 },
  { name: "Salaberry north", latitude: 45.3799167, longitude: -73.7506565, zoneIndex: 1 },
  { name: "Léry corridor", latitude: 45.3566734, longitude: -73.7843179, zoneIndex: 2 },
  { name: "Mercier corridor", latitude: 45.310444, longitude: -73.746051, zoneIndex: 3 },
] as const;

describe("polygon delivery zones", () => {
  it.each(expectedLocations)("places $name in its intended road corridor", (location) => {
    const matches = RECOMMENDED_CHATEAUGUAY_ZONES.map((zone) =>
      pointIsInDeliveryZonePolygon(location, zone.boundaryGeoJson),
    );

    expect(matches[location.zoneIndex]).toBe(true);
    expect(matches.filter(Boolean)).toHaveLength(1);
  });

  it("excludes Kahnawà:ke, the Mercier Bridge corridor, and Montréal", () => {
    const excluded = [
      { latitude: 45.4147888, longitude: -73.6773614 },
      { latitude: 45.442, longitude: -73.664 },
      { latitude: 45.5019, longitude: -73.5674 },
    ];

    for (const location of excluded) {
      expect(
        RECOMMENDED_CHATEAUGUAY_ZONES.some((zone) =>
          pointIsInDeliveryZonePolygon(location, zone.boundaryGeoJson),
        ),
      ).toBe(false);
    }
  });

  it("treats an exact polygon edge as included", () => {
    const polygon = RECOMMENDED_CHATEAUGUAY_ZONES[0].boundaryGeoJson;
    const [longitude, latitude] = polygon.coordinates[0][0];

    expect(pointIsInDeliveryZonePolygon({ latitude, longitude }, polygon)).toBe(true);
  });

  it("rejects malformed or unclosed GeoJSON instead of guessing", () => {
    expect(parseDeliveryZonePolygon({ type: "Polygon", coordinates: [] })).toBeNull();
    expect(
      parseDeliveryZonePolygon({
        type: "Polygon",
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
      }),
    ).toBeNull();
  });

  it("excludes points inside polygon holes", () => {
    const polygon = parseDeliveryZonePolygon({
      type: "Polygon",
      coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
      ],
    });

    expect(polygon).not.toBeNull();
    expect(pointIsInDeliveryZonePolygon({ latitude: 2, longitude: 2 }, polygon!)).toBe(true);
    expect(pointIsInDeliveryZonePolygon({ latitude: 5, longitude: 5 }, polygon!)).toBe(false);
  });
});
