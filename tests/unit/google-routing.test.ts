import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleRoutesProvider } from "../../lib/providers/google-routing";

afterEach(() => vi.restoreAllMocks());

describe("Google route matrix validation", () => {
  it("fails closed when a successful response omits matrix elements", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", status: { code: 0 }, duration: "0s", distanceMeters: 0 }]), { status: 200 }));
    const result = await new GoogleRoutesProvider("fake-key").computeMatrix([{ id: "a", latitude: 45.5, longitude: -73.5 }, { id: "b", latitude: 45.6, longitude: -73.6 }]);
    expect(result).toMatchObject({ kind: "unknown", error: { code: "MATRIX_INCOMPLETE", retryable: true } });
  });

  it("classifies rate limits and transient element statuses as retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("limited", { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify([{ originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", status: { code: 14, message: "UNAVAILABLE" } }]), { status: 200 }));
    const provider = new GoogleRoutesProvider("fake-key");
    await expect(provider.computeMatrix([{ id: "a", latitude: 45.5, longitude: -73.5 }])).resolves.toMatchObject({ kind: "transient_failure", error: { code: "HTTP_429" } });
    await expect(provider.computeMatrix([{ id: "a", latitude: 45.5, longitude: -73.5 }])).resolves.toMatchObject({ kind: "transient_failure", error: { code: "MATRIX_STATUS_14" } });
  });

  it("rejects duplicate and out-of-range matrix elements", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", status: { code: 0 }, duration: "0s", distanceMeters: 0 },
      { originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", status: { code: 0 }, duration: "1s", distanceMeters: 1 },
    ]), { status: 200 }));
    const duplicate = await new GoogleRoutesProvider("fake-key").computeMatrix([{ id: "a", latitude: 45.5, longitude: -73.5 }]);
    expect(duplicate).toMatchObject({ kind: "terminal_failure", error: { code: "MATRIX_DUPLICATE_ELEMENT" } });
  });
});
