ALTER TABLE "RestaurantOrderSettings"
ADD COLUMN "dispatchMaxWaitMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "dispatchDeadlineBufferMinutes" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "dispatchLowDemandReleaseCount" INTEGER NOT NULL DEFAULT 2,
ADD CONSTRAINT "RestaurantOrderSettings_dispatch_policy_check" CHECK (
  "dispatchMaxWaitMinutes" BETWEEN 1 AND 120 AND
  "dispatchDeadlineBufferMinutes" BETWEEN 1 AND 180 AND
  "dispatchLowDemandReleaseCount" BETWEEN 1 AND 4
);
