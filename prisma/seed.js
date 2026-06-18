const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const time = (value) => new Date(`1970-01-01T${value}:00.000Z`);

async function upsertCategory(data) {
  const existing = await prisma.menuCategory.findFirst({
    where: { name: data.name },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return prisma.menuCategory.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.menuCategory.create({ data });
}

async function upsertMenuItem(data) {
  const existing = await prisma.menuItem.findFirst({
    where: {
      categoryId: data.categoryId,
      name: data.name,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return prisma.menuItem.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.menuItem.create({ data });
}

async function upsertModifierGroup(data, options) {
  const existing = await prisma.modifierGroup.findFirst({
    where: { name: data.name },
    orderBy: { createdAt: "asc" },
  });
  const group = existing
    ? await prisma.modifierGroup.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.modifierGroup.create({ data });

  for (const option of options) {
    const existingOption = await prisma.modifierOption.findFirst({
      where: {
        modifierGroupId: group.id,
        name: option.name,
      },
      orderBy: { createdAt: "asc" },
    });

    if (existingOption) {
      await prisma.modifierOption.update({
        where: { id: existingOption.id },
        data: option,
      });
    } else {
      await prisma.modifierOption.create({
        data: {
          modifierGroupId: group.id,
          ...option,
        },
      });
    }
  }

  return group;
}

async function assignModifierGroup(menuItemId, modifierGroupId, sortOrder) {
  await prisma.menuItemModifierGroup.upsert({
    where: {
      menuItemId_modifierGroupId: {
        menuItemId,
        modifierGroupId,
      },
    },
    update: { sortOrder },
    create: {
      menuItemId,
      modifierGroupId,
      sortOrder,
    },
  });
}

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

  await prisma.restaurantOrderSettings.upsert({
    where: { id: 1 },
    update: {
      onlineOrderingEnabled: true,
      pickupEnabled: true,
      deliveryEnabled: false,
    },
    create: {
      id: 1,
      onlineOrderingEnabled: true,
      pickupEnabled: true,
      deliveryEnabled: false,
    },
  });

  const combos = await upsertCategory({
    name: "Combos",
    description: "ASAP pickup favorites for the ordering MVP.",
    sortOrder: 10,
    isActive: true,
  });
  const sides = await upsertCategory({
    name: "Sides",
    description: "Simple add-ons for pickup orders.",
    sortOrder: 20,
    isActive: true,
  });

  const spice = await upsertModifierGroup(
    {
      name: "Spice level",
      description: "Choose one heat level.",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 10,
      isActive: true,
    },
    [
      { name: "Mild", priceDeltaCents: 0, sortOrder: 10, isAvailable: true, isActive: true },
      { name: "Medium", priceDeltaCents: 0, sortOrder: 20, isAvailable: true, isActive: true },
      { name: "Spicy", priceDeltaCents: 0, sortOrder: 30, isAvailable: true, isActive: true },
    ],
  );
  const extras = await upsertModifierGroup(
    {
      name: "Extras",
      description: "Optional add-ons.",
      minSelections: 0,
      maxSelections: 2,
      isRequired: false,
      sortOrder: 20,
      isActive: true,
    },
    [
      { name: "Extra sauce", priceDeltaCents: 150, sortOrder: 10, isAvailable: true, isActive: true },
      { name: "Extra rice", priceDeltaCents: 250, sortOrder: 20, isAvailable: true, isActive: true },
      { name: "Spring roll", priceDeltaCents: 300, sortOrder: 30, isAvailable: true, isActive: true },
    ],
  );

  const generalTao = await upsertMenuItem({
    categoryId: combos.id,
    name: "General Tao Chicken Combo",
    description: "Crispy chicken, steamed rice, vegetables, and house sauce.",
    priceCents: 1895,
    imageUrl: null,
    sortOrder: 10,
    isAvailable: true,
    isActive: true,
  });
  const sushi = await upsertMenuItem({
    categoryId: combos.id,
    name: "Sushi Lunch Box",
    description: "Assorted sushi, salad, and chef-selected side.",
    priceCents: 2195,
    imageUrl: null,
    sortOrder: 20,
    isAvailable: true,
    isActive: true,
  });
  const dumplings = await upsertMenuItem({
    categoryId: sides.id,
    name: "Pork Dumplings",
    description: "Six pan-fried dumplings with dipping sauce.",
    priceCents: 995,
    imageUrl: null,
    sortOrder: 10,
    isAvailable: true,
    isActive: true,
  });

  await assignModifierGroup(generalTao.id, spice.id, 10);
  await assignModifierGroup(generalTao.id, extras.id, 20);
  await assignModifierGroup(sushi.id, extras.id, 10);
  await assignModifierGroup(dumplings.id, extras.id, 10);
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
