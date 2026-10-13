import type { OrderedRoute, ProviderResult, RouteMatrix, RoutePoint, RoutingProvider } from "@/lib/providers/contracts";

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  condition?: string;
  status?: { code?: number; message?: string };
  duration?: string;
  distanceMeters?: number;
};

const seconds = (duration: string | undefined) => Math.round(Number(duration?.replace(/s$/, "")));
const transientGrpcCodes = new Set([4, 8, 13, 14]);

export class GoogleRoutesProvider implements RoutingProvider {
  constructor(private readonly apiKey: string) {}
  async computeMatrix(points: RoutePoint[]): Promise<ProviderResult<RouteMatrix>> {
    try {
      const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration,fallbackInfo" },
        body: JSON.stringify({
          origins: points.map((point) => ({ waypoint: { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } } })),
          destinations: points.map((point) => ({ waypoint: { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } } })),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      if (!response.ok) {
        const retryable = response.status >= 500 || [408, 409, 429].includes(response.status);
        return { kind: retryable ? "transient_failure" : "terminal_failure", error: { code: `HTTP_${response.status}`, message: "Route matrix request failed.", retryable }, attempt: 1 };
      }
      const elements = (await response.json()) as MatrixElement[];
      const durationsSeconds = points.map(() => points.map(() => 0));
      const distancesMeters = points.map(() => points.map(() => 0));
      const seen = new Set<string>();
      for (const element of elements) {
        const statusCode = element.status?.code ?? 0;
        if (statusCode !== 0) {
          const retryable = transientGrpcCodes.has(statusCode);
          return { kind: retryable ? "transient_failure" : "terminal_failure", error: { code: `MATRIX_STATUS_${statusCode}`, message: element.status?.message ?? "A route matrix element was unavailable.", retryable }, attempt: 1 };
        }
        if (element.originIndex === undefined || element.destinationIndex === undefined) {
          return { kind: "unknown", error: { code: "MATRIX_ELEMENT_INCOMPLETE", message: "A route matrix element omitted its indexes.", retryable: true }, attempt: 1 };
        }
        if (element.condition !== "ROUTE_EXISTS") {
          return { kind: "terminal_failure", error: { code: "ROUTE_NOT_FOUND", message: "Google reported that no route exists for a matrix element.", retryable: false }, attempt: 1 };
        }
        const duration = seconds(element.duration);
        if (!Number.isFinite(duration) || typeof element.distanceMeters !== "number") return { kind: "terminal_failure", error: { code: "MATRIX_ELEMENT_INVALID", message: "Route matrix element omitted duration or distance.", retryable: false }, attempt: 1 };
        if (element.originIndex < 0 || element.originIndex >= points.length || element.destinationIndex < 0 || element.destinationIndex >= points.length) return { kind: "terminal_failure", error: { code: "MATRIX_INDEX_INVALID", message: "Route matrix contained an out-of-range index.", retryable: false }, attempt: 1 };
        const key = `${element.originIndex}:${element.destinationIndex}`;
        if (seen.has(key)) return { kind: "terminal_failure", error: { code: "MATRIX_DUPLICATE_ELEMENT", message: "Route matrix contained a duplicate element.", retryable: false }, attempt: 1 };
        seen.add(key);
        durationsSeconds[element.originIndex]![element.destinationIndex] = duration;
        distancesMeters[element.originIndex]![element.destinationIndex] = element.distanceMeters;
      }
      if (seen.size !== points.length * points.length) return { kind: "unknown", error: { code: "MATRIX_INCOMPLETE", message: "Route matrix omitted one or more origin/destination elements.", retryable: true }, attempt: 1 };
      return { kind: "success", value: { durationsSeconds, distancesMeters }, attempt: 1, recovered: false };
    } catch (error) {
      return { kind: "unknown", error: { code: "ROUTING_UNKNOWN", message: error instanceof Error ? error.message : String(error), retryable: true }, attempt: 1 };
    }
  }
  async orderStops(origin: RoutePoint, stops: RoutePoint[]): Promise<ProviderResult<OrderedRoute>> {
    const points = [origin, ...stops];
    const matrix = await this.computeMatrix(points);
    if (matrix.kind !== "success") {
      if (matrix.kind === "duplicate") return { kind: "duplicate", attempt: matrix.attempt };
      return { kind: matrix.kind, error: matrix.error, attempt: matrix.attempt };
    }
    const remaining = new Set(stops.map((_, index) => index + 1));
    const ordered: number[] = [];
    let current = 0;
    while (remaining.size) {
      const next = [...remaining].sort((a, b) => matrix.value.durationsSeconds[current]![a]! - matrix.value.durationsSeconds[current]![b]! || points[a]!.id.localeCompare(points[b]!.id))[0]!;
      ordered.push(next); remaining.delete(next); current = next;
    }
    return { kind: "success", value: { orderedStopIds: ordered.map((index) => points[index]!.id), durationSeconds: ordered.reduce((sum, index, position) => sum + matrix.value.durationsSeconds[position === 0 ? 0 : ordered[position - 1]!]![index]!, 0), distanceMeters: ordered.reduce((sum, index, position) => sum + matrix.value.distancesMeters[position === 0 ? 0 : ordered[position - 1]!]![index]!, 0) }, attempt: 1, recovered: false };
  }
}
