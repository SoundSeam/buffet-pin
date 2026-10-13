"use client";

import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

import { parseDeliveryZonePolygon } from "@/lib/orders/delivery-zone-geometry";

export type DeliveryZoneMapItem = {
  configurationKey: string | null;
  name: string;
  displayColor: string | null;
  boundaryGeoJson: unknown;
};

type Props = {
  zones: DeliveryZoneMapItem[];
  restaurant: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
};

export default function DeliveryZoneMap({ zones, restaurant }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const initialize = async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const zoneFeatures: Feature<Polygon>[] = zones.flatMap((zone) => {
        const polygon = parseDeliveryZonePolygon(zone.boundaryGeoJson);
        if (!polygon) return [];

        return [{
          type: "Feature",
          properties: {
            key: zone.configurationKey ?? zone.name,
            name: zone.name,
            color: zone.displayColor ?? "#0F766E",
          },
          geometry: {
            type: "Polygon",
            coordinates: polygon.coordinates.map((ring) =>
              ring.map(([longitude, latitude]) => [longitude, latitude]),
            ),
          },
        }];
      });
      const zoneCollection: FeatureCollection<Polygon> = {
        type: "FeatureCollection",
        features: zoneFeatures,
      };
      const restaurantPoint: FeatureCollection<Point> = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { name: restaurant.name },
          geometry: {
            type: "Point",
            coordinates: [restaurant.longitude, restaurant.latitude],
          },
        }],
      };

      const map = new maplibregl.Map({
        container: containerRef.current,
        center: [restaurant.longitude, restaurant.latitude],
        zoom: 10.6,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      map.on("load", () => {
        map.addSource("delivery-zones", { type: "geojson", data: zoneCollection });
        map.addLayer({
          id: "delivery-zone-fill",
          type: "fill",
          source: "delivery-zones",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.25,
          },
        });
        map.addLayer({
          id: "delivery-zone-outline",
          type: "line",
          source: "delivery-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
          },
        });
        map.addSource("restaurant", { type: "geojson", data: restaurantPoint });
        map.addLayer({
          id: "restaurant-halo",
          type: "circle",
          source: "restaurant",
          paint: {
            "circle-radius": 11,
            "circle-color": "#FFFFFF",
            "circle-stroke-color": "#062F24",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "restaurant-dot",
          type: "circle",
          source: "restaurant",
          paint: { "circle-radius": 5, "circle-color": "#E11D48" },
        });

        if (zoneFeatures.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          for (const feature of zoneFeatures) {
            for (const ring of feature.geometry.coordinates) {
              for (const coordinate of ring) {
                bounds.extend([coordinate[0], coordinate[1]]);
              }
            }
          }
          bounds.extend([restaurant.longitude, restaurant.latitude]);
          map.fitBounds(bounds, { padding: 38, maxZoom: 12 });
        }

        map.on("mouseenter", "delivery-zone-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "delivery-zone-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "delivery-zone-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature?.properties?.name) return;

          new maplibregl.Popup({ closeButton: false, offset: 8 })
            .setLngLat(event.lngLat)
            .setText(String(feature.properties.name))
            .addTo(map);
        });
      });
    };

    void initialize();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [restaurant, zones]);

  return (
    <div className="relative overflow-hidden rounded-surface border border-[#062F24]/15 bg-[#EDF2EF] shadow-sm">
      <div
        ref={containerRef}
        className="h-[520px] w-full"
        aria-label="Map of the four Buffet Pin delivery zones"
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded-button bg-white/95 px-3 py-2 text-xs font-bold text-[#062F24] shadow-sm">
        Red dot: Buffet Pin · Click a zone for its name
      </div>
    </div>
  );
}
