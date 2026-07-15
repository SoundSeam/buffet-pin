import { Prisma } from "@prisma/client";

import { drinkMenuCategories, type DrinkMenuCategory } from "@/content/drinks-menu";
import { db } from "@/lib/db";

function isMissingDrinkMenuTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function getPublicDrinkMenu(): Promise<DrinkMenuCategory[]> {
  try {
    const categories = await db.drinkCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        },
      },
    });

    if (categories.length === 0) {
      return [];
    }

    return categories.map((category) => ({
      id: category.id,
      name: { en: category.nameEn, fr: category.nameFr },
      items: category.items.map((item) => ({
        id: item.id,
        name: { en: item.nameEn, fr: item.nameFr },
        ...(item.descriptionEn || item.descriptionFr
          ? {
              description: {
                en: item.descriptionEn ?? "",
                fr: item.descriptionFr ?? "",
              },
            }
          : {}),
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        price: item.priceCents / 100,
      })),
    }));
  } catch (error) {
    // Keep the public page available before the first database migration is
    // applied. Other database failures should remain visible to operators.
    if (isMissingDrinkMenuTable(error)) {
      return drinkMenuCategories;
    }

    throw error;
  }
}
