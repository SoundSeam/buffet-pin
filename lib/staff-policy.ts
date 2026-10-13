import { StaffRole } from "@prisma/client";

export const staffCapabilities = [
  "ORDERS_READ",
  "ORDER_INTAKE_WRITE",
  "PRODUCTION_WRITE",
  "PRINT_WRITE",
  "DISPATCH_WRITE",
  "REPORTING_READ",
  "CATALOG_WRITE",
  "SETTINGS_WRITE",
  "REFUND_WRITE",
  "STAFF_WRITE",
  "DEV_TOOLS",
] as const;
export type StaffCapability = (typeof staffCapabilities)[number];

const matrix: Record<StaffRole, ReadonlySet<StaffCapability>> = {
  [StaffRole.MANAGER]: new Set([
    "ORDERS_READ",
    "ORDER_INTAKE_WRITE",
    "PRODUCTION_WRITE",
    "PRINT_WRITE",
    "DISPATCH_WRITE",
    "REPORTING_READ",
    "CATALOG_WRITE",
    "SETTINGS_WRITE",
    "REFUND_WRITE",
    "STAFF_WRITE",
  ]),
  [StaffRole.OPERATOR]: new Set([
    "ORDERS_READ",
    "ORDER_INTAKE_WRITE",
    "PRODUCTION_WRITE",
    "PRINT_WRITE",
    "DISPATCH_WRITE",
  ]),
  [StaffRole.DISPATCHER]: new Set(["ORDERS_READ", "DISPATCH_WRITE"]),
  [StaffRole.REPORTING]: new Set(["ORDERS_READ", "REPORTING_READ"]),
  [StaffRole.TECHNICAL]: new Set(["ORDERS_READ", "DEV_TOOLS"]),
};

export function roleHasCapability(
  role: StaffRole,
  capability: StaffCapability,
) {
  return matrix[role].has(capability);
}

export function roleHasAnyCapability(
  role: StaffRole,
  capabilities: readonly StaffCapability[],
) {
  return capabilities.some((capability) => roleHasCapability(role, capability));
}
