import {
  OrderDispatchStatus,
  OrderPaymentStatus,
  OrderProductionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { generateTrackingToken } from "../../lib/orders/identity";
import { parseTrackingCredential } from "../../lib/orders/tracking-credential";
import {
  canTransitionDispatchStatus,
  canTransitionPaymentStatus,
  canTransitionProductionStatus,
} from "../../lib/orders/status";

describe("M1 order domain", () => {
  it("creates high-entropy URL-safe tracking credentials", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateTrackingToken()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("never treats the operational number as a public tracking credential", () => {
    expect(parseTrackingCredential("BP-260722-0001")).toBeNull();
    const token = generateTrackingToken();
    expect(parseTrackingCredential(token)).toEqual({ kind: "token", value: token });
    expect(parseTrackingCredential("ABCDEFGHJK")).toEqual({
      kind: "legacy",
      value: "ABCDEFGHJK",
    });
    expect(parseTrackingCredential("123e4567-e89b-42d3-a456-426614174000")).toEqual({
      kind: "token",
      value: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("never downgrades a confirmed payment", () => {
    expect(canTransitionPaymentStatus(OrderPaymentStatus.PAID, OrderPaymentStatus.FAILED)).toBe(false);
    expect(canTransitionPaymentStatus(OrderPaymentStatus.PAID, OrderPaymentStatus.PENDING)).toBe(false);
    expect(canTransitionPaymentStatus(OrderPaymentStatus.FAILED, OrderPaymentStatus.PAID)).toBe(true);
  });

  it("requires production to pass packing before the dispatch desk", () => {
    expect(
      canTransitionProductionStatus(
        OrderProductionStatus.PREPARING,
        OrderProductionStatus.AT_DISPATCH_DESK,
      ),
    ).toBe(false);
    expect(
      canTransitionProductionStatus(OrderProductionStatus.PACKING, OrderProductionStatus.PACKED),
    ).toBe(true);
    expect(
      canTransitionProductionStatus(
        OrderProductionStatus.PACKED,
        OrderProductionStatus.AT_DISPATCH_DESK,
      ),
    ).toBe(true);
  });

  it("rejects stale or backward dispatch transitions", () => {
    expect(
      canTransitionDispatchStatus(OrderDispatchStatus.UNASSIGNED, OrderDispatchStatus.PICKED_UP),
    ).toBe(false);
    expect(
      canTransitionDispatchStatus(OrderDispatchStatus.EN_ROUTE, OrderDispatchStatus.DELIVERED),
    ).toBe(true);
    expect(
      canTransitionDispatchStatus(OrderDispatchStatus.DELIVERED, OrderDispatchStatus.EN_ROUTE),
    ).toBe(false);
  });
});
