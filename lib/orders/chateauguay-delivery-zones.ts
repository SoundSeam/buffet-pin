import type { DeliveryZonePolygon } from "@/lib/orders/delivery-zone-geometry";

export const BUFFET_PIN_COORDINATES = {
  latitude: 45.3610197,
  longitude: -73.7142625,
} as const;

export type RecommendedDeliveryZone = {
  configurationKey: string;
  name: string;
  displayColor: string;
  description: string;
  targetDriveMinutes: number;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  freeDeliveryThresholdCents: null;
  sortOrder: number;
  boundaryGeoJson: DeliveryZonePolygon;
};

/**
 * Launch polygons are intentionally corridor-shaped rather than concentric rings.
 * They group stops that leave the restaurant in the same direction and stop before
 * the Mercier Bridge/Montréal corridor. Road-time targets are planning estimates,
 * not traffic guarantees, and must be confirmed during the field route rehearsal.
 */
export const RECOMMENDED_CHATEAUGUAY_ZONES: readonly RecommendedDeliveryZone[] = [
  {
    configurationKey: "CHATEAUGUAY_SAINT_JEAN_BAPTISTE",
    name: "Zone 1 — Saint-Jean-Baptiste / East",
    displayColor: "#0F766E",
    description:
      "Closest corridor around the restaurant and eastern Châteauguay. Uses Saint-Jean-Baptiste and Route 132/138 without entering the Mercier Bridge corridor.",
    targetDriveMinutes: 10,
    centerLatitude: 45.3615,
    centerLongitude: -73.704,
    radiusKm: 4.5,
    deliveryFeeCents: 399,
    minimumOrderCents: 2000,
    freeDeliveryThresholdCents: null,
    sortOrder: 10,
    boundaryGeoJson: {
      type: "Polygon",
      coordinates: [[
        [-73.735, 45.342],
        [-73.69, 45.334],
        [-73.672, 45.352],
        [-73.683, 45.38],
        [-73.708, 45.392],
        [-73.724, 45.376],
        [-73.735, 45.342],
      ]],
    },
  },
  {
    configurationKey: "CHATEAUGUAY_CENTRE_RIVER",
    name: "Zone 2 — Châteauguay Centre / River",
    displayColor: "#2563EB",
    description:
      "Dense central and river-side neighbourhoods. Groups north-west stops reached through Arthur-Laberge, D'Anjou, Maple and Salaberry.",
    targetDriveMinutes: 15,
    centerLatitude: 45.373,
    centerLongitude: -73.752,
    radiusKm: 6.5,
    deliveryFeeCents: 499,
    minimumOrderCents: 2500,
    freeDeliveryThresholdCents: null,
    sortOrder: 20,
    boundaryGeoJson: {
      type: "Polygon",
      coordinates: [[
        [-73.774, 45.34],
        [-73.735, 45.342],
        [-73.724, 45.376],
        [-73.708, 45.392],
        [-73.724, 45.41],
        [-73.768, 45.404],
        [-73.79, 45.378],
        [-73.774, 45.34],
      ]],
    },
  },
  {
    configurationKey: "CHATEAUGUAY_LERY_WEST",
    name: "Zone 3 — Léry / Maple Grove West",
    displayColor: "#7C3AED",
    description:
      "Western Route 132 corridor through Maple Grove toward Léry. Kept separate because every stop commits the driver west before returning.",
    targetDriveMinutes: 18,
    centerLatitude: 45.351,
    centerLongitude: -73.807,
    radiusKm: 8.5,
    deliveryFeeCents: 699,
    minimumOrderCents: 3500,
    freeDeliveryThresholdCents: null,
    sortOrder: 30,
    boundaryGeoJson: {
      type: "Polygon",
      coordinates: [[
        [-73.835, 45.318],
        [-73.774, 45.34],
        [-73.79, 45.378],
        [-73.82, 45.383],
        [-73.846, 45.367],
        [-73.845, 45.338],
        [-73.835, 45.318],
      ]],
    },
  },
  {
    configurationKey: "CHATEAUGUAY_MERCIER_SOUTH",
    name: "Zone 4 — Mercier / Route 138 South",
    displayColor: "#EA580C",
    description:
      "Southern Route 138 corridor into Mercier. Separated from west and central runs so drivers do not cross back through Châteauguay between stops.",
    targetDriveMinutes: 16,
    centerLatitude: 45.309,
    centerLongitude: -73.747,
    radiusKm: 8.5,
    deliveryFeeCents: 699,
    minimumOrderCents: 3500,
    freeDeliveryThresholdCents: null,
    sortOrder: 40,
    boundaryGeoJson: {
      type: "Polygon",
      coordinates: [[
        [-73.835, 45.318],
        [-73.774, 45.34],
        [-73.735, 45.342],
        [-73.69, 45.334],
        [-73.706, 45.3],
        [-73.734, 45.278],
        [-73.775, 45.281],
        [-73.806, 45.306],
        [-73.835, 45.318],
      ]],
    },
  },
] as const;
