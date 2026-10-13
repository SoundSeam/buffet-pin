export type GeoJsonPosition = [longitude: number, latitude: number];

export type DeliveryZonePolygon = {
  type: "Polygon";
  coordinates: GeoJsonPosition[][];
};

const COORDINATE_EPSILON = 1e-10;

function isFinitePosition(value: unknown): value is GeoJsonPosition {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function positionsEqual(left: GeoJsonPosition, right: GeoJsonPosition): boolean {
  return (
    Math.abs(left[0] - right[0]) <= COORDINATE_EPSILON &&
    Math.abs(left[1] - right[1]) <= COORDINATE_EPSILON
  );
}

function isValidRing(value: unknown): value is GeoJsonPosition[] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every(isFinitePosition) &&
    positionsEqual(value[0], value[value.length - 1])
  );
}

export function parseDeliveryZonePolygon(value: unknown): DeliveryZonePolygon | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (
    candidate.type !== "Polygon" ||
    !Array.isArray(candidate.coordinates) ||
    candidate.coordinates.length === 0 ||
    !candidate.coordinates.every(isValidRing)
  ) {
    return null;
  }

  return {
    type: "Polygon",
    coordinates: candidate.coordinates.map((ring) =>
      ring.map((position) => [position[0], position[1]]),
    ),
  };
}

function pointIsOnSegment(
  point: GeoJsonPosition,
  start: GeoJsonPosition,
  end: GeoJsonPosition,
): boolean {
  const segmentLengthSquared =
    (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
  if (segmentLengthSquared <= COORDINATE_EPSILON ** 2) {
    return positionsEqual(point, start);
  }

  const crossProduct =
    (point[1] - start[1]) * (end[0] - start[0]) -
    (point[0] - start[0]) * (end[1] - start[1]);

  if (Math.abs(crossProduct) > COORDINATE_EPSILON) return false;

  const dotProduct =
    (point[0] - start[0]) * (end[0] - start[0]) +
    (point[1] - start[1]) * (end[1] - start[1]);
  if (dotProduct < -COORDINATE_EPSILON) return false;

  return dotProduct <= segmentLengthSquared + COORDINATE_EPSILON;
}

function pointIsInRing(point: GeoJsonPosition, ring: GeoJsonPosition[]): boolean {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[previous];
    const end = ring[index];

    if (pointIsOnSegment(point, start, end)) return true;

    const crossesLatitude = start[1] > point[1] !== end[1] > point[1];
    if (!crossesLatitude) continue;

    const crossingLongitude =
      ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) +
      start[0];
    if (point[0] < crossingLongitude) inside = !inside;
  }

  return inside;
}

export function pointIsInDeliveryZonePolygon(
  destination: { latitude: number; longitude: number },
  polygon: DeliveryZonePolygon,
): boolean {
  const point: GeoJsonPosition = [destination.longitude, destination.latitude];
  const [outerRing, ...holes] = polygon.coordinates;

  if (!pointIsInRing(point, outerRing)) return false;
  return holes.every((hole) => !pointIsInRing(point, hole));
}
