import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, settings] = await Promise.all([
    db.menuCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: {
          where: { isActive: true, isAvailable: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            modifierGroups: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              include: {
                modifierGroup: {
                  include: {
                    options: {
                      where: { isActive: true, isAvailable: true },
                      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.restaurantOrderSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        items: category.items.map((item) => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
          modifierGroups: item.modifierGroups
            .filter((assignment) => assignment.modifierGroup.isActive)
            .map((assignment) => ({
              assignmentId: assignment.id,
              id: assignment.modifierGroup.id,
              name: assignment.modifierGroup.name,
              description: assignment.modifierGroup.description,
              minSelections: assignment.modifierGroup.minSelections,
              maxSelections: assignment.modifierGroup.maxSelections,
              isRequired: assignment.modifierGroup.isRequired,
              sortOrder: assignment.sortOrder,
              options: assignment.modifierGroup.options.map((option) => ({
                id: option.id,
                modifierGroupId: option.modifierGroupId,
                name: option.name,
                priceDeltaCents: option.priceDeltaCents,
                sortOrder: option.sortOrder,
              })),
          })),
        })),
      })),
      orderSettings: {
        deliveryFeeCents: settings.deliveryFeeCents,
        freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
      },
    },
  });
}
