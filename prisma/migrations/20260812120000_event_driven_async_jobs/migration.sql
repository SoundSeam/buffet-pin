CREATE TYPE "AsyncJobLane" AS ENUM ('CRITICAL', 'NOTIFICATION');
CREATE TYPE "AsyncJobState" AS ENUM ('PENDING', 'DISPATCHING', 'DISPATCHED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AsyncJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lane" "AsyncJobLane" NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "AsyncJobState" NOT NULL DEFAULT 'PENDING',
    "dispatchAttempts" INTEGER NOT NULL DEFAULT 0,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "queueMessageId" TEXT,
    "scheduleName" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AsyncJob_dedupeKey_key" ON "AsyncJob"("dedupeKey");
CREATE UNIQUE INDEX "AsyncJob_scheduleName_key" ON "AsyncJob"("scheduleName");
CREATE INDEX "AsyncJob_state_runAt_idx" ON "AsyncJob"("state", "runAt");
CREATE INDEX "AsyncJob_lane_state_runAt_idx" ON "AsyncJob"("lane", "state", "runAt");
CREATE INDEX "AsyncJob_aggregateType_aggregateId_createdAt_idx" ON "AsyncJob"("aggregateType", "aggregateId", "createdAt");
CREATE INDEX "AsyncJob_leaseExpiresAt_idx" ON "AsyncJob"("leaseExpiresAt");

-- Transactional outbox triggers keep job creation inseparable from the domain
-- write. They never perform network I/O inside the transaction.
CREATE FUNCTION buffet_pin_enqueue_notification_job() RETURNS trigger AS $$
BEGIN
  INSERT INTO "AsyncJob" (
    "id", "kind", "lane", "aggregateType", "aggregateId", "dedupeKey",
    "runAt", "state", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, 'SEND_NOTIFICATION', 'NOTIFICATION', 'Notification',
    NEW."id", 'notification:' || NEW."id", CURRENT_TIMESTAMP, 'PENDING',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buffet_pin_notification_outbox
AFTER INSERT ON "Notification"
FOR EACH ROW EXECUTE FUNCTION buffet_pin_enqueue_notification_job();

CREATE FUNCTION buffet_pin_enqueue_order_invalidation() RETURNS trigger AS $$
BEGIN
  INSERT INTO "AsyncJob" (
    "id", "kind", "lane", "aggregateType", "aggregateId", "payload",
    "dedupeKey", "runAt", "state", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, 'REALTIME_INVALIDATION', 'CRITICAL', 'Order',
    NEW."orderId", jsonb_build_object('revision', NEW."id"),
    'order-event:' || NEW."id", CURRENT_TIMESTAMP, 'PENDING',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ) ON CONFLICT ("dedupeKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buffet_pin_order_event_outbox
AFTER INSERT ON "OrderEvent"
FOR EACH ROW EXECUTE FUNCTION buffet_pin_enqueue_order_invalidation();

CREATE FUNCTION buffet_pin_schedule_reservation_reminder() RETURNS trigger AS $$
DECLARE
  reminder_key text;
  reminder_at timestamp(3);
BEGIN
  -- Previously scheduled versions become harmless tombstones. A delivered SQS
  -- message for one of them will observe CANCELLED and perform no work.
  UPDATE "AsyncJob"
  SET "state" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "aggregateType" = 'Reservation'
    AND "aggregateId" = NEW."id"
    AND "kind" = 'SEND_RESERVATION_REMINDER'
    AND "state" IN ('PENDING', 'DISPATCHING', 'DISPATCHED', 'FAILED');

  IF NEW."status" = 'CONFIRMED' AND NEW."reminderSentAt" IS NULL THEN
    reminder_at := NEW."reservationAt" - INTERVAL '24 hours';
    reminder_key := 'reservation-reminder:' || NEW."id" || ':' ||
      floor(extract(epoch from NEW."reservationAt"))::bigint::text;
    INSERT INTO "AsyncJob" (
      "id", "kind", "lane", "aggregateType", "aggregateId", "dedupeKey",
      "runAt", "state", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, 'SEND_RESERVATION_REMINDER', 'NOTIFICATION',
      'Reservation', NEW."id", reminder_key, reminder_at, 'PENDING',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) ON CONFLICT ("dedupeKey") DO UPDATE SET
      "state" = CASE
        WHEN "AsyncJob"."state" = 'COMPLETED' THEN "AsyncJob"."state"
        ELSE 'PENDING'::"AsyncJobState"
      END,
      "runAt" = EXCLUDED."runAt",
      "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buffet_pin_reservation_reminder_outbox
AFTER INSERT OR UPDATE OF "reservationAt", "status", "reminderSentAt" ON "Reservation"
FOR EACH ROW EXECUTE FUNCTION buffet_pin_schedule_reservation_reminder();
