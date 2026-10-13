import { StaffRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { roleHasCapability } from "../../lib/staff-policy";

describe("staff capability policy", () => {
  it("keeps financial, catalog, settings, and staff authority manager-only", () => {
    for (const capability of [
      "REFUND_WRITE",
      "CATALOG_WRITE",
      "SETTINGS_WRITE",
      "STAFF_WRITE",
    ] as const) {
      expect(roleHasCapability(StaffRole.MANAGER, capability)).toBe(true);
      expect(roleHasCapability(StaffRole.OPERATOR, capability)).toBe(false);
      expect(roleHasCapability(StaffRole.DISPATCHER, capability)).toBe(false);
      expect(roleHasCapability(StaffRole.REPORTING, capability)).toBe(false);
      expect(roleHasCapability(StaffRole.TECHNICAL, capability)).toBe(false);
    }
  });

  it("keeps technical access separate from restaurant and financial authority", () => {
    expect(roleHasCapability(StaffRole.TECHNICAL, "DEV_TOOLS")).toBe(true);
    expect(roleHasCapability(StaffRole.TECHNICAL, "REFUND_WRITE")).toBe(false);
    expect(roleHasCapability(StaffRole.TECHNICAL, "REPORTING_READ")).toBe(
      false,
    );
    expect(roleHasCapability(StaffRole.MANAGER, "DEV_TOOLS")).toBe(false);
  });

  it("scopes operator, dispatcher, and reporting permissions", () => {
    expect(roleHasCapability(StaffRole.OPERATOR, "PRODUCTION_WRITE")).toBe(
      true,
    );
    expect(roleHasCapability(StaffRole.OPERATOR, "ORDER_INTAKE_WRITE")).toBe(true);
    expect(roleHasCapability(StaffRole.OPERATOR, "DISPATCH_WRITE")).toBe(true);
    expect(roleHasCapability(StaffRole.DISPATCHER, "DISPATCH_WRITE")).toBe(
      true,
    );
    expect(roleHasCapability(StaffRole.REPORTING, "ORDERS_READ")).toBe(true);
    expect(roleHasCapability(StaffRole.REPORTING, "PRODUCTION_WRITE")).toBe(
      false,
    );
  });
});
