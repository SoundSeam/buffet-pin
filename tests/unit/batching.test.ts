import { describe, expect, it } from "vitest";
import { suggestDispatchBatches } from "../../lib/orders/batching";
import { DeterministicScenarioPlan, FakeRoutingProvider } from "../../lib/providers/fakes";
import { composePickupDeliveryWindow } from "../../lib/orders/run-operations";

const now = new Date("2026-07-22T18:00:00.000Z");
const candidate = (id: string, zoneId = "east") => ({ id, zoneId, atDeskAt: new Date(now.getTime() - 15 * 60_000), dispatchDeadlineAt: new Date(now.getTime() + 10 * 60_000), latitude: 45.5, longitude: -73.5 });
const policy = { maxWaitMinutes: 10, deadlineBufferMinutes: 20, lowDemandReleaseCount: 2 };
const origin = { id: "restaurant", latitude: 45.5, longitude: -73.6 };

describe("assisted batching", () => {
  it("keeps zones separate, caps four, and explains release", async () => {
    const routing = new FakeRoutingProvider(new DeterministicScenarioPlan());
    const result = await suggestDispatchBatches([candidate("a"), candidate("b"), candidate("c", "west")], policy, routing, origin, now);
    expect(result).toHaveLength(2);
    expect(result.every((batch) => batch.orderIds.length <= 4)).toBe(true);
    expect(result[0]?.explanation).toContain("same zone");
  });

  it("falls back to stable manual order when routing is unavailable", async () => {
    const routing = new FakeRoutingProvider(new DeterministicScenarioPlan({ "routing.orderStops": ["timeout"] }));
    const result = await suggestDispatchBatches([candidate("a"), candidate("b")], policy, routing, origin, now);
    expect(result[0]).toMatchObject({ orderIds: ["a", "b"], routingStatus: "MANUAL_FALLBACK" });
  });

  it.each([
    ["capacity", Array.from({ length: 4 }, (_, index) => candidate(String(index))), { ...policy, maxWaitMinutes: 60, deadlineBufferMinutes: 1, lowDemandReleaseCount: 0 }],
    ["oldest-wait", [candidate("old")], { ...policy, lowDemandReleaseCount: 0 }],
    ["deadline-risk", [{ ...candidate("urgent"), atDeskAt: now, dispatchDeadlineAt: new Date(now.getTime() + 5 * 60_000) }], { ...policy, maxWaitMinutes: 60, lowDemandReleaseCount: 0 }],
    ["low-demand", [{ ...candidate("quiet"), atDeskAt: now, dispatchDeadlineAt: new Date(now.getTime() + 60 * 60_000) }], { ...policy, maxWaitMinutes: 60, deadlineBufferMinutes: 1, lowDemandReleaseCount: 2 }],
  ])("releases deterministically for %s", async (reason, orders, selectedPolicy) => {
    const result = await suggestDispatchBatches(orders, selectedPolicy, new FakeRoutingProvider(new DeterministicScenarioPlan()), origin, now);
    expect(result[0]?.reasons).toContain(reason);
  });

  it("does not suggest a batch before any explainable release trigger", async () => {
    const fresh = { ...candidate("fresh"), atDeskAt: now, dispatchDeadlineAt: new Date(now.getTime() + 60 * 60_000) };
    const result = await suggestDispatchBatches([fresh], { ...policy, maxWaitMinutes: 60, deadlineBufferMinutes: 1, lowDemandReleaseCount: 0 }, new FakeRoutingProvider(new DeterministicScenarioPlan()), origin, now);
    expect(result).toEqual([]);
  });

  it("composes a conservative pickup-time delivery window from route time plus buffer", () => {
    const window = composePickupDeliveryWindow(now, 900);
    expect(window?.startAt).toEqual(now);
    expect(window?.endAt.getTime()).toBe(now.getTime() + 25 * 60_000);
    expect(composePickupDeliveryWindow(now, null)).toBeNull();
  });
});
