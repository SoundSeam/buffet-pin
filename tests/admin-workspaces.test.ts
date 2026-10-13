import { describe, expect, it } from "vitest";

import {
  buildReservationSearch,
  getAdminLandingPath,
  resolveAdminOrderStage,
} from "@/lib/admin-workspaces";
import { legacyAudienceRedirects } from "@/lib/audience-routes";

describe("reduced admin workspace routing", () => {
  it("lands a manager on the restaurant operations home", () => {
    expect(getAdminLandingPath("MANAGER")).toBe("/admin");
  });

  it("allows a manager to select the nested Orders stages", () => {
    expect(resolveAdminOrderStage("MANAGER", "exceptions")).toBe("exceptions");
  });

  it("rejects unknown manager Orders stages", () => {
    expect(resolveAdminOrderStage("MANAGER", "legacy")).toBe("intake");
  });

  it("lands each focused audience in its own product", () => {
    expect(getAdminLandingPath("OPERATOR")).toBe("/admin/orders");
    expect(getAdminLandingPath("DISPATCHER")).toBe("/admin/drivers");
    expect(getAdminLandingPath("REPORTING")).toBe("/reports");
    expect(getAdminLandingPath("TECHNICAL")).toBe("/dev");
  });

  it("syncs standalone Reservations filters without legacy workspace state", () => {
    const params = buildReservationSearch({
      displayMode: "calendar",
      status: "ALL",
      calendarView: "week",
      anchorDate: "2026-08-13",
      listDate: "",
    });

    expect(params.has("area")).toBe(false);
    expect(params.get("view")).toBe("week");
    expect(params.get("date")).toBe("2026-08-13");
  });

  it("keeps the required audience-split redirects stable", () => {
    expect(legacyAudienceRedirects).toEqual({
      operations: "/dev/operations",
      catalog: "/dev/clover/catalog",
      reconciliation: "/reports/daily",
      machineTest: "/dev/machine-test",
    });
  });
});
