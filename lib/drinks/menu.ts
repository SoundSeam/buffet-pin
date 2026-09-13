import type { DrinkMenuCategory } from "@/content/drinks-menu";
import { db } from "@/lib/db";

export async function getPublicDrinkMenu(): Promise<DrinkMenuCategory[]> {
  const categories = await db.drinkCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: { items: { where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] } },
  });
  return categories.filter((category) => category.items.length > 0).map((category) => ({
    id: category.id,
    name: { en: category.nameEn, fr: category.nameFr },
    items: category.items.map((item) => ({
      id: item.id,
      name: { en: item.nameEn, fr: item.nameFr },
      description: { en: item.descriptionEn ?? "", fr: item.descriptionFr ?? "" },
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      price: item.priceCents === null ? null : item.priceCents / 100,
    })),
  }));
}
