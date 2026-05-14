import { Prisma, type PrismaClient, type Settings, type SlotCapacitySetting } from "@prisma/client";

function timeOnly(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

const defaultSettingsCreateInput = {
  id: 1,
  slotCapacityGuests: 24,
  minPartySize: 6,
  maxPartySize: 15,
  firstSlot: timeOnly("16:30"),
  lastSlot: timeOnly("20:00"),
  slotIntervalMinutes: 30,
  guestModifyCutoffHours: 24,
} satisfies Prisma.SettingsCreateInput;

export type ReservationSettings = Settings & {
  slotCapacities: Pick<
    SlotCapacitySetting,
    "reservationTime" | "capacityGuests"
  >[];
};

type ReservationSettingsDb = PrismaClient | Prisma.TransactionClient;

function isMissingTableError(error: unknown, tableName: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.meta?.table === tableName
  );
}

export async function ensureSlotCapacitySettingsTable(
  db: ReservationSettingsDb,
): Promise<void> {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SlotCapacitySetting" (
      "id" TEXT NOT NULL,
      "settingsId" INTEGER NOT NULL DEFAULT 1,
      "reservationTime" TIME(0) NOT NULL,
      "capacityGuests" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "SlotCapacitySetting_pkey" PRIMARY KEY ("id")
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SlotCapacitySetting_settingsId_reservationTime_key"
    ON "SlotCapacitySetting"("settingsId", "reservationTime")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SlotCapacitySetting_settingsId_idx"
    ON "SlotCapacitySetting"("settingsId")
  `);

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'SlotCapacitySetting_settingsId_fkey'
      ) THEN
        ALTER TABLE "SlotCapacitySetting"
        ADD CONSTRAINT "SlotCapacitySetting_settingsId_fkey"
        FOREIGN KEY ("settingsId") REFERENCES "Settings"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

async function loadSlotCapacities(
  db: ReservationSettingsDb,
  settingsId: number,
  ordered: boolean,
): Promise<ReservationSettings["slotCapacities"]> {
  const query = {
    where: { settingsId },
    ...(ordered ? { orderBy: { reservationTime: "asc" as const } } : {}),
    select: {
      reservationTime: true,
      capacityGuests: true,
    },
  };

  try {
    return await db.slotCapacitySetting.findMany(query);
  } catch (error) {
    if (!isMissingTableError(error, "public.SlotCapacitySetting")) {
      throw error;
    }

    await ensureSlotCapacitySettingsTable(db);
    return db.slotCapacitySetting.findMany(query);
  }
}

export async function getReservationSettings(
  db: ReservationSettingsDb,
  options?: { includeSlotCapacities?: boolean; orderedSlotCapacities?: boolean },
): Promise<ReservationSettings> {
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: defaultSettingsCreateInput,
  });

  if (options?.includeSlotCapacities === false) {
    return { ...settings, slotCapacities: [] };
  }

  const slotCapacities = await loadSlotCapacities(
    db,
    settings.id,
    options?.orderedSlotCapacities ?? false,
  );

  return { ...settings, slotCapacities };
}
