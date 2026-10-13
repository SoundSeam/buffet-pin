export const asyncJobKinds = {
  notification: "SEND_NOTIFICATION",
  reservationReminder: "SEND_RESERVATION_REMINDER",
  realtimeInvalidation: "REALTIME_INVALIDATION",
  operationalScan: "OPERATIONAL_SCAN",
  orderAcceptanceDeadline: "EXPIRE_ORDER_ACCEPTANCE",
} as const;

export type AsyncJobKind = (typeof asyncJobKinds)[keyof typeof asyncJobKinds];

export const ASYNC_JOB_LEASE_MS = 5 * 60_000;
export const ASYNC_CALLBACK_MAX_AGE_SECONDS = 5 * 60;
