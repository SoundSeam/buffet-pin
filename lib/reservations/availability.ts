import "server-only";

import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ReservationRuleError } from "@/lib/reservations/rules";

// Request-local memoization only: a saved switch applies on the next request.
export const getOnlineReservationsEnabled = cache(async (): Promise<boolean> => {
  noStore();
  try {
    const settings = await db.settings.findUnique({
      where: { id: 1 },
      select: { onlineReservationsEnabled: true },
    });
    return settings?.onlineReservationsEnabled === true;
  } catch {
    console.error("Unable to read online reservation availability; booking is disabled.");
    return false;
  }
});

export async function assertOnlineReservationsEnabled(tx: Prisma.TransactionClient) {
  // Hold a shared row lock until booking commits. Disabling waits for bookings
  // already being committed; later bookings observe the disabled value.
  const [settings] = await tx.$queryRaw<Array<{ onlineReservationsEnabled: boolean }>>`
    SELECT "onlineReservationsEnabled" FROM "Settings" WHERE "id" = 1 FOR SHARE
  `;
  if (!settings?.onlineReservationsEnabled) {
    throw new ReservationRuleError("RESERVATIONS_DISABLED", "Online reservations are currently unavailable. Please call (450) 699-8088.");
  }
}

export async function setOnlineReservationsEnabled(
  tx: Prisma.TransactionClient,
  enabled: boolean,
  actorId: string,
) {
  const [current] = await tx.$queryRaw<Array<{ onlineReservationsEnabled: boolean }>>`
    SELECT "onlineReservationsEnabled" FROM "Settings" WHERE "id" = 1 FOR UPDATE
  `;
  if (!current) throw new Error("Reservation settings are missing.");
  if (current.onlineReservationsEnabled === enabled) return;
  await tx.settings.update({ where: { id: 1 }, data: { onlineReservationsEnabled: enabled } });
  await tx.reservationAvailabilityEvent.create({
    data: { previousEnabled: current.onlineReservationsEnabled, enabled, actorId },
  });
}
