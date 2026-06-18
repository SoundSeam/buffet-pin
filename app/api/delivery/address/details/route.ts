import { NextResponse } from "next/server";

import { getGeocodingConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function getGoogleMapsApiKey() {
  try {
    const config = getGeocodingConfig(true);
    return config.provider === "google" ? config.googleMapsApiKey : null;
  } catch {
    return null;
  }
}

function findComponent(
  components: AddressComponent[],
  type: string,
  field: "longText" | "shortText" = "longText",
) {
  return components.find((component) => component.types?.includes(type))?.[field] ?? "";
}

function buildAddressLine1(components: AddressComponent[], fallback: string) {
  const streetNumber = findComponent(components, "street_number");
  const route = findComponent(components, "route");
  const line = [streetNumber, route].filter(Boolean).join(" ");

  if (line) return line;
  return fallback.split(",")[0]?.trim() ?? fallback;
}

function buildCity(components: AddressComponent[]) {
  return (
    findComponent(components, "locality") ||
    findComponent(components, "postal_town") ||
    findComponent(components, "administrative_area_level_3") ||
    findComponent(components, "administrative_area_level_2")
  );
}

export async function GET(request: Request) {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return errorResponse(
      503,
      "ADDRESS_DETAILS_NOT_CONFIGURED",
      "Address autocomplete is not configured.",
    );
  }

  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId")?.trim() ?? "";

  if (!placeId) {
    return errorResponse(400, "PLACE_ID_REQUIRED", "Select an address first.");
  }

  const googlePlaceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;

  const response = await fetch(`https://places.googleapis.com/v1/${googlePlaceName}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { status?: string };
    } | null;

    return errorResponse(
      502,
      payload?.error?.status ?? "ADDRESS_DETAILS_FAILED",
      "Unable to load this address right now.",
    );
  }

  const payload = (await response.json()) as {
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    location?: { latitude?: number; longitude?: number };
  };

  if (!payload.addressComponents) {
    return errorResponse(
      404,
      "ADDRESS_NOT_FOUND",
      "Select a more specific delivery address.",
    );
  }

  const formattedAddress = payload.formattedAddress ?? "";
  const components = payload.addressComponents;
  const address = {
    addressLine1: buildAddressLine1(components, formattedAddress),
    addressLine2: "",
    city: buildCity(components),
    province: findComponent(components, "administrative_area_level_1", "shortText"),
    postalCode: findComponent(components, "postal_code"),
    country: findComponent(components, "country", "shortText") || "CA",
    formattedAddress,
  };

  if (!address.addressLine1 || !address.city || !address.province || !address.postalCode) {
    return errorResponse(
      422,
      "ADDRESS_INCOMPLETE",
      "Select a complete street address with a postal code.",
    );
  }

  return NextResponse.json({ ok: true, data: { address } });
}
