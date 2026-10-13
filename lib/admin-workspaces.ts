export type AdminStaffRole =
  "MANAGER" | "OPERATOR" | "DISPATCHER" | "REPORTING" | "TECHNICAL";

export type AdminOrderStage =
  "intake" | "production" | "dispatch" | "exceptions" | "close";

const managerOrderStages = new Set<AdminOrderStage>([
  "intake",
  "production",
  "dispatch",
  "exceptions",
  "close",
]);

export function resolveAdminOrderStage(
  role: AdminStaffRole,
  requestedStage?: string,
): AdminOrderStage {
  if (role === "OPERATOR") return "production";
  if (role === "DISPATCHER") return "dispatch";
  if (role === "REPORTING") return "close";
  if (role === "TECHNICAL") return "exceptions";

  return managerOrderStages.has(requestedStage as AdminOrderStage)
    ? (requestedStage as AdminOrderStage)
    : "intake";
}

export function getAdminLandingPath(role: AdminStaffRole) {
  if (role === "MANAGER") return "/admin";
  if (role === "OPERATOR") return "/admin/orders";
  if (role === "DISPATCHER") return "/admin/drivers";
  if (role === "REPORTING") return "/reports";
  return "/dev";
}

export function buildReservationSearch({
  displayMode,
  status,
  calendarView,
  anchorDate,
  listDate,
}: {
  displayMode: "calendar" | "list";
  status: string;
  calendarView: "month" | "week" | "day";
  anchorDate: string;
  listDate: string;
}) {
  const params = new URLSearchParams();
  params.set("mode", displayMode);
  params.set("status", status);

  if (displayMode === "calendar") {
    params.set("view", calendarView);
    params.set("date", anchorDate);
  } else if (listDate) {
    params.set("listDate", listDate);
  }

  return params;
}
