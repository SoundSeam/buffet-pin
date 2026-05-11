const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const time = (value) => new Date(`1970-01-01T${value}:00.000Z`);

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      minPartySize: 6,
      maxPartySize: 15,
      firstSlot: time("16:30"),
      lastSlot: time("20:00"),
    },
    create: {
      id: 1,
      slotCapacityGuests: 24,
      minPartySize: 6,
      maxPartySize: 15,
      firstSlot: time("16:30"),
      lastSlot: time("20:00"),
      slotIntervalMinutes: 30,
      guestModifyCutoffHours: 24,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
