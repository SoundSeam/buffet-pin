import "server-only";

import type { DeliveryZone, Prisma, RestaurantOrderSettings } from "@prisma/client";

import { db } from "@/lib/db";
import { getGeocodingConfig } from "@/lib/env";
import {
  type DeliveryAddressInput,
  deliveryValidationSchema,
} from "@/lib/orders/validation";

type DeliveryDbClient = Prisma.TransactionClient | typeof db;

export class DeliveryValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DeliveryValidationError";
  }
}

export type NormalizedDeliveryAddress = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  deliveryInstructions: string | null;
  formattedAddress: string;
};

export type GeocodedAddress = {
  latitude: number;
  longitude: number;
  formattedAddress?: string | null;
};

export type GeocodingProvider = {
  geocode(address: NormalizedDeliveryAddress): Promise<GeocodedAddress | null>;
};

export type DeliverySnapshot = {
  address: NormalizedDeliveryAddress;
  latitude: number;
  longitude: number;
  distanceKm: number;
  zoneId: string;
  zoneName: string;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  freeDeliveryThresholdCents: number | null;
};

const EARTH_RADIUS_KM = 6371.0088;

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePostalCode(postalCode: string): string {
  return postalCode.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeDeliveryAddress(
  rawAddress: DeliveryAddressInput,
): NormalizedDeliveryAddress {
  const parsed = deliveryValidationSchema.shape.address.parse(rawAddress);
  const address: NormalizedDeliveryAddress = {
    addressLine1: parsed.addressLine1.trim().replace(/\s+/g, " "),
    addressLine2: normalizeOptionalText(parsed.addressLine2),
    city: parsed.city.trim().replace(/\s+/g, " "),
    province: parsed.province.trim().toUpperCase(),
    postalCode: normalizePostalCode(parsed.postalCode),
    country: parsed.country.trim().toUpperCase(),
    deliveryInstructions: normalizeOptionalText(parsed.deliveryInstructions),
    formattedAddress: "",
  };

  address.formattedAddress = [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.province,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");

  return address;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateHaversineDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): number {
  const latitudeDelta = degreesToRadians(destination.latitude - origin.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function assertCoordinate(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new DeliveryValidationError(
      "DELIVERY_SETTINGS_INCOMPLETE",
      `${label} must be configured for delivery.`,
    );
  }
}

function validateDeliverySettings(settings: RestaurantOrderSettings): {
  restaurantLatitude: number;
  restaurantLongitude: number;
} {
  if (!settings.deliveryEnabled) {
    throw new DeliveryValidationError(
      "DELIVERY_DISABLED",
      "Delivery ordering is unavailable.",
    );
  }

  if (
    settings.restaurantLatitude === null ||
    settings.restaurantLongitude === null
  ) {
    throw new DeliveryValidationError(
      "DELIVERY_SETTINGS_INCOMPLETE",
      "Restaurant coordinates must be configured before delivery can be validated.",
    );
  }

  assertCoordinate(settings.restaurantLatitude, "Restaurant latitude");
  assertCoordinate(settings.restaurantLongitude, "Restaurant longitude");

  if (!Number.isFinite(settings.deliveryRadiusKm) || settings.deliveryRadiusKm <= 0) {
    throw new DeliveryValidationError(
      "DELIVERY_SETTINGS_INCOMPLETE",
      "Delivery radius must be configured before delivery can be validated.",
    );
  }

  return {
    restaurantLatitude: settings.restaurantLatitude,
    restaurantLongitude: settings.restaurantLongitude,
  };
}

function calculateDeliveryFeeCents(
  zone: DeliveryZone,
  itemsSubtotalCents: number,
): number {
  if (
    zone.freeDeliveryThresholdCents !== null &&
    itemsSubtotalCents >= zone.freeDeliveryThresholdCents
  ) {
    return 0;
  }

  return zone.deliveryFeeCents;
}

function selectMatchingZone(
  zones: DeliveryZone[],
  destination: { latitude: number; longitude: number },
): { zone: DeliveryZone; zoneDistanceKm: number } {
  for (const zone of zones) {
    const zoneDistanceKm = calculateHaversineDistanceKm(
      { latitude: zone.centerLatitude, longitude: zone.centerLongitude },
      destination,
    );

    if (zoneDistanceKm <= zone.radiusKm) {
      return { zone, zoneDistanceKm };
    }
  }

  throw new DeliveryValidationError(
    "DELIVERY_OUT_OF_RANGE",
    "This address is outside the delivery area.",
  );
}

async function googleGeocode(
  address: NormalizedDeliveryAddress,
  apiKey: string,
): Promise<GeocodedAddress | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address.formattedAddress);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new DeliveryValidationError(
      "GEOCODING_FAILED",
      "Unable to validate this delivery address.",
      { status: response.status },
    );
  }

  const payload = (await response.json()) as {
    status?: string;
    results?: {
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }[];
  };

  if (payload.status !== "OK" || !payload.results?.[0]?.geometry?.location) {
    return null;
  }

  const location = payload.results[0].geometry.location;

  if (typeof location.lat !== "number" || typeof location.lng !== "number") {
    return null;
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
    formattedAddress: payload.results[0].formatted_address ?? null,
  };
}

function createConfiguredGeocoder(deliveryEnabled: boolean): GeocodingProvider {
  const config = getGeocodingConfig(deliveryEnabled);

  if (config.provider === "none") {
    return {
      async geocode() {
        return null;
      },
    };
  }

  return {
    geocode(address) {
      return googleGeocode(address, config.googleMapsApiKey);
    },
  };
}

export async function validateDelivery(
  rawInput: unknown,
  client: DeliveryDbClient = db,
  geocoder?: GeocodingProvider,
): Promise<DeliverySnapshot> {
  const input = deliveryValidationSchema.parse(rawInput);
  const address = normalizeDeliveryAddress(input.address);
  const settings = await client.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const { restaurantLatitude, restaurantLongitude } =
    validateDeliverySettings(settings);
  const resolvedGeocoder = geocoder ?? createConfiguredGeocoder(settings.deliveryEnabled);
  const geocodedAddress = await resolvedGeocoder.geocode(address);

  if (!geocodedAddress) {
    throw new DeliveryValidationError(
      "GEOCODING_FAILED",
      "Unable to validate this delivery address.",
    );
  }

  const distanceKm = calculateHaversineDistanceKm(
    { latitude: restaurantLatitude, longitude: restaurantLongitude },
    {
      latitude: geocodedAddress.latitude,
      longitude: geocodedAddress.longitude,
    },
  );

  if (distanceKm > settings.deliveryRadiusKm) {
    throw new DeliveryValidationError(
      "DELIVERY_OUT_OF_RANGE",
      "This address is outside the delivery radius.",
      {
        distanceKm,
        deliveryRadiusKm: settings.deliveryRadiusKm,
      },
    );
  }

  const zones = await client.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (zones.length === 0) {
    throw new DeliveryValidationError(
      "DELIVERY_SETTINGS_INCOMPLETE",
      "At least one active delivery zone must be configured before delivery can be validated.",
    );
  }

  const { zone } = selectMatchingZone(zones, {
    latitude: geocodedAddress.latitude,
    longitude: geocodedAddress.longitude,
  });
  const itemsSubtotalCents = input.itemsSubtotalCents ?? 0;

  if (itemsSubtotalCents < zone.minimumOrderCents) {
    throw new DeliveryValidationError(
      "DELIVERY_MINIMUM_NOT_MET",
      "Delivery minimum order amount has not been met.",
      {
        minimumDeliveryOrderCents: zone.minimumOrderCents,
        itemsSubtotalCents,
      },
    );
  }

  const normalizedGeocodedAddress = geocodedAddress.formattedAddress
    ? { ...address, formattedAddress: geocodedAddress.formattedAddress }
    : address;

  return {
    address: normalizedGeocodedAddress,
    latitude: geocodedAddress.latitude,
    longitude: geocodedAddress.longitude,
    distanceKm,
    zoneId: zone.id,
    zoneName: zone.name,
    deliveryFeeCents: calculateDeliveryFeeCents(zone, itemsSubtotalCents),
    minimumOrderCents: zone.minimumOrderCents,
    freeDeliveryThresholdCents: zone.freeDeliveryThresholdCents,
  };
}
