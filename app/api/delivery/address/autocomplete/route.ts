import { NextResponse } from "next/server";

import { getGeocodingConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

const RESTAURANT_LOCATION = {
  latitude: 45.360646,
  longitude: -73.713994,
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

export async function GET(request: Request) {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return errorResponse(
      503,
      "ADDRESS_AUTOCOMPLETE_NOT_CONFIGURED",
      "Address autocomplete is not configured.",
    );
  }

  const url = new URL(request.url);
  const input = url.searchParams.get("query")?.trim() ?? "";

  if (input.length < 3) {
    return NextResponse.json({ ok: true, data: { suggestions: [] } });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      origin: RESTAURANT_LOCATION,
      languageCode: "en-CA",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { status?: string };
    } | null;

    return errorResponse(
      502,
      payload?.error?.status ?? "ADDRESS_AUTOCOMPLETE_FAILED",
      "Unable to search addresses right now.",
    );
  }

  const payload = (await response.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };

  return NextResponse.json({
    ok: true,
    data: {
      suggestions:
        payload.suggestions
          ?.map((suggestion) => suggestion.placePrediction)
          .filter((prediction) => prediction?.placeId && prediction.text?.text)
          .slice(0, 6)
          .map((prediction) => ({
            placeId: prediction!.placeId,
            description: prediction!.text?.text,
            mainText: prediction!.structuredFormat?.mainText?.text ?? prediction!.text?.text,
            secondaryText: prediction!.structuredFormat?.secondaryText?.text ?? "",
          })) ?? [],
    },
  });
}
